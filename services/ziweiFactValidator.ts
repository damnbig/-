export type FactValidationIssueKind =
  | 'INPUT'
  | 'SOURCE'
  | 'DECLARATION'
  | 'REFERENCE'
  | 'NARRATIVE'
  | 'CLOSURE';

export type FactValidationQuestion =
  | 'AUTO'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4'
  | 'Q5'
  | 'Q6'
  | 'Q7'
  | 'Q7B'
  | 'Q8'
  | 'Q9'
  | 'Q10'
  | 'Q11'
  | 'Q12'
  | 'Q12B';

export type ValidationLayerStatus = 'PASS' | 'BLOCKED' | 'NOT_CHECKED';

export type FactValidationIssue = {
  kind: FactValidationIssueKind;
  message: string;
  line?: number;
  id?: string;
};

export type FactValidationResult = {
  status: 'PASS' | 'BLOCKED';
  question: FactValidationQuestion;
  referenceStatus: ValidationLayerStatus;
  closureStatus: ValidationLayerStatus;
  roleStatus: 'NOT_CHECKED';
  sourceFactCount: number;
  declarationCount: number;
  validDeclarationCount: number;
  referenceCount: number;
  resolvedEvidence: { evidenceId: string; factId: string; fact: string }[];
  closureRequired: { factId: string; reason: string }[];
  closureCovered: string[];
  missingClosure: { factId: string; reason: string }[];
  caseId: string;
  fingerprint: string;
  issues: FactValidationIssue[];
};

export type EvidencePatchMergeResult = {
  mergedAnswer: string;
  acceptedLines: string[];
  missingEvidenceIds: string[];
  rejectedLines: string[];
};

export type InlineReferenceRepairResult = {
  repairedAnswer: string;
  replacements: { factId: string; evidenceId: string; count: number }[];
  unresolvedFactIds: string[];
};

const FACT_ID_SOURCE = '(?:DA\\d{2}-L\\d{2}|(?:F\\d{2}|D0[1-3]|DA\\d{2})-[LQKJ]|Z\\d{3}|BS\\d{2}|M\\d{2}|B\\d{2}|R\\d{2}|S\\d{2}|D0[1-3]|DA\\d{2}|LY\\d{2}|Y\\d{2})';
const FACT_ID_PATTERN = new RegExp(FACT_ID_SOURCE, 'g');
const COMPACT_EVIDENCE_PATTERN = new RegExp(`^\\s*(E\\d{2,3})\\s*=\\s*(${FACT_ID_SOURCE})\\s*$`, 'i');
const PATCH_EVIDENCE_PATTERN = new RegExp(`\\b(E\\d{2,3})\\s*=\\s*(${FACT_ID_SOURCE})\\b`, 'gi');
const EVIDENCE_ID_PATTERN = /\bE\d{2,3}\b/gi;
const TECHNICAL_RELATION_PATTERN = /(?:B\d{2}.{0,80}(?:→|飞入|飞出|飞向|入宫|冲|对宫|三合|向心|离心|自化|化[禄权科忌])|(?:→|飞入|飞出|飞向|冲|对宫|三合|向心|离心|自化|化[禄权科忌]).{0,80}B\d{2})/;

function extractCanonicalFact(line: string): string | null {
  const factIndex = line.indexOf('FACT|');
  if (factIndex < 0) return null;
  return line
    .slice(factIndex)
    .replace(/\s+\[Source:.*$/i, '')
    .trim();
}

function factId(line: string): string {
  return line.split('|')[1]?.trim() || '';
}

function idsIn(text: string): string[] {
  return Array.from(new Set(text.match(FACT_ID_PATTERN) || []));
}

function evidenceId(line: string): string | null {
  const factIndex = line.indexOf('FACT|');
  if (factIndex < 0) return null;
  const match = line.slice(0, factIndex).match(/\b(E\d{2,3})\s*[：:]/i);
  return match?.[1]?.toUpperCase() || null;
}

function compactEvidence(line: string): { evidenceId: string; factId: string } | null {
  const match = line.match(COMPACT_EVIDENCE_PATTERN);
  if (!match) return null;
  return {
    evidenceId: match[1].toUpperCase(),
    factId: match[2].toUpperCase(),
  };
}

function factField(line: string, field: string): string | null {
  const match = line.match(new RegExp(`\\|${field}=([^|]+)`));
  return match?.[1]?.trim() || null;
}

function detectedQuestions(answer: string): FactValidationQuestion[] {
  // A later question may legitimately cite earlier C conclusions inline. Only
  // treat C identifiers that open a conclusion heading as submitted answers.
  const conclusionHeadingPattern = /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(?:\d+[.、)]\s*)?(?:\*\*)?C(1[0-2]|[1-9])(B?)[-－]\d+\b/gm;
  return Array.from(
    new Set(Array.from(answer.matchAll(conclusionHeadingPattern)).map(match => `Q${match[1]}${match[2]}`)),
  ) as FactValidationQuestion[];
}

function questionDetectionScope(answer: string, requested: FactValidationQuestion): string {
  if (requested !== 'Q11' && requested !== 'Q12B') return answer;
  const matrixPattern = requested === 'Q11'
    ? /(?:大限暂定矩阵|暂定大限矩阵|PROVISIONAL_DECADA_MATRIX)/i
    : /(?:十年大限运程转换暂定矩阵|下一大限[^\n]{0,20}暂定矩阵|DECADA_TRANSITION_MATRIX)/i;
  const matrixStart = answer.search(matrixPattern);
  return matrixStart >= 0 ? answer.slice(0, matrixStart) : answer;
}

function inferQuestion(answer: string, requested: FactValidationQuestion): FactValidationQuestion {
  const detected = detectedQuestions(questionDetectionScope(answer, requested));
  if (requested === 'AUTO') return detected.length === 1 ? detected[0] : 'AUTO';
  return requested;
}

function relationshipClosure(sourceFactLines: string[]): { factId: string; reason: string }[] {
  const spousePalace = sourceFactLines.find(
    line => factField(line, 'TYPE') === 'PALACE' && factField(line, 'PALACE_NAME') === '夫妻宫',
  );
  if (!spousePalace) return [];
  const spouseId = factId(spousePalace);
  const required = new Map<string, string>();
  const add = (line: string, reason: string) => required.set(factId(line), reason);

  add(spousePalace, '夫妻宫身份');
  sourceFactLines.forEach(line => {
    const type = factField(line, 'TYPE');
    if (type === 'RELATION' && factField(line, 'SELF') === spouseId) {
      add(line, '夫妻宫三方四正关系');
    }
    if (
      type === 'ITEM'
      && factField(line, 'PALACE') === spouseId
      && (
        factField(line, 'CATEGORY') === '主星'
        || [factField(line, 'BIRTH_HUA'), factField(line, 'SELF_HUA'), factField(line, 'INCOMING_HUA')]
          .some(value => Boolean(value && value !== '—'))
      )
    ) {
      add(line, '夫妻宫主星或带四化标记的星曜');
    }
    if (type === 'BIRTH_HUA' && factField(line, 'TARGET') === spouseId) {
      add(line, '生年四化落入夫妻宫');
    }
    if (
      type === 'TRANSFORM'
      && factField(line, 'LAYER') === '本命宫干飞化'
      && (factField(line, 'SOURCE') === spouseId || factField(line, 'TARGET') === spouseId)
    ) {
      add(line, '夫妻宫本命飞化出入');
    }
    if (
      type === 'SELF_HUA'
      && [factField(line, 'MARKER_PALACE'), factField(line, 'SOURCE'), factField(line, 'TARGET')].includes(spouseId)
    ) {
      add(line, '夫妻宫离心或向心结构');
    }
  });
  return Array.from(required, ([factIdValue, reason]) => ({ factId: factIdValue, reason }));
}

export function validateNotebookAnswer(
  answer: string,
  notebookFacts: string,
  requestedQuestion: FactValidationQuestion = 'AUTO',
): FactValidationResult {
  const issues: FactValidationIssue[] = [];
  const sourceFactLines = notebookFacts
    .split(/\r?\n/)
    .map(extractCanonicalFact)
    .filter((line): line is string => Boolean(line));
  const sourceFacts = new Map(sourceFactLines.map(line => [factId(line), line]));

  if (!notebookFacts.includes('iZiwei Notebook Fact Pack v1')) {
    issues.push({ kind: 'SOURCE', message: '事实源不是iZiwei Notebook Fact Pack v1。' });
  }
  if (!notebookFacts.includes('校验状态：PASS')) {
    issues.push({ kind: 'SOURCE', message: '事实包没有通过网页校验。' });
  }
  if (!sourceFacts.size) {
    issues.push({ kind: 'SOURCE', message: '事实包中没有可核验的FACT记录。' });
  }
  if (sourceFacts.size !== sourceFactLines.length) {
    issues.push({ kind: 'SOURCE', message: '事实包存在重复FACT编号。' });
  }
  const declaredFactCount = notebookFacts.match(/事实总数：(\d+)/)?.[1];
  if (declaredFactCount && Number(declaredFactCount) !== sourceFactLines.length) {
    issues.push({ kind: 'SOURCE', message: '事实包头部总数与实际FACT行数不一致。' });
  }
  const sourceCases = new Set(sourceFactLines.map(line => factField(line, 'CASE')).filter(Boolean));
  const sourceFingerprints = new Set(sourceFactLines.map(line => factField(line, 'FP')).filter(Boolean));
  const caseId = Array.from(sourceCases)[0] || '';
  const fingerprint = Array.from(sourceFingerprints)[0] || '';
  const question = inferQuestion(answer, requestedQuestion);
  const detected = detectedQuestions(questionDetectionScope(answer, requestedQuestion));
  const closureRequired = question === 'Q6' ? relationshipClosure(sourceFactLines) : [];
  if (requestedQuestion !== 'AUTO' && detected.length === 1 && detected[0] !== requestedQuestion) {
    issues.push({
      kind: 'INPUT',
      message: `页面选择的是${requestedQuestion}，但正文C编号属于${detected[0]}。请核对题号，避免用错误范围验收。`,
    });
  }
  if (detected.length > 1) {
    issues.push({
      kind: 'INPUT',
      message: `回答中同时出现${detected.join('、')}的C编号。每次只提交当前一道问题的回答。`,
    });
  }
  if (sourceFactLines.some(line => !factField(line, 'CASE') || !factField(line, 'FP'))) {
    issues.push({ kind: 'SOURCE', message: '事实包中存在缺少CASE或FP的FACT行。' });
  }
  if (sourceCases.size !== 1 || sourceFingerprints.size !== 1) {
    issues.push({ kind: 'SOURCE', message: '事实包中的CASE或FP不唯一。' });
  }

  const userTurnCount = (answer.match(/(?:^|\n)\s*(?:User|用户)\s*:/gi) || []).length;
  const modelTurnCount = (answer.match(/(?:^|\n)\s*(?:Model|模型)\s*:/gi) || []).length;
  if (userTurnCount > 0 || modelTurnCount > 1) {
    issues.push({
      kind: 'INPUT',
      message: '检测到问题文本或多轮对话。每次只粘贴当前一道问题的Model回答，不要粘贴User问题、此前回答或整份对话导出。',
    });
    return {
      status: 'BLOCKED',
      question,
      referenceStatus: 'BLOCKED',
      closureStatus: question === 'Q6' ? 'BLOCKED' : 'NOT_CHECKED',
      roleStatus: 'NOT_CHECKED',
      sourceFactCount: sourceFacts.size,
      declarationCount: 0,
      validDeclarationCount: 0,
      referenceCount: 0,
      resolvedEvidence: [],
      closureRequired,
      closureCovered: [],
      missingClosure: closureRequired,
      caseId,
      fingerprint,
      issues,
    };
  }

  const answerLines = answer.split(/\r?\n/);
  const submittedEvidence: { lineNumber: number; id: string; evidenceId: string | null }[] = [];
  const validEvidenceIds = new Set<string>();
  const evidenceBindings = new Map<string, string>();
  const resolvedEvidence = new Map<string, { evidenceId: string; factId: string; fact: string }>();
  let validDeclarationCount = 0;

  answerLines.forEach((line, index) => {
    const canonical = extractCanonicalFact(line);
    const compact = compactEvidence(line);
    if (!canonical && !compact) return;
    const id = canonical ? factId(canonical) : compact!.factId;
    const currentEvidenceId = canonical ? evidenceId(line) : compact!.evidenceId;
    let declarationValid = true;
    submittedEvidence.push({ lineNumber: index + 1, id, evidenceId: currentEvidenceId });
    if (!currentEvidenceId) {
      declarationValid = false;
      issues.push({
        kind: 'DECLARATION',
        line: index + 1,
        id,
        message: `${id || '该FACT'}前缺少E编号绑定。推荐使用“E01=${id || '事实编号'}”。`,
      });
    } else {
      const previousFactId = evidenceBindings.get(currentEvidenceId);
      if (previousFactId && previousFactId !== id) {
        declarationValid = false;
        issues.push({
          kind: 'DECLARATION',
          line: index + 1,
          id,
          message: `${currentEvidenceId}前后绑定了不同事实（${previousFactId}与${id}）；请为其中一项改用新的E编号。`,
        });
      } else if (!previousFactId) {
        evidenceBindings.set(currentEvidenceId, id);
      }
    }
    const expected = sourceFacts.get(id);
    if (!expected) {
      declarationValid = false;
      issues.push({
        kind: 'DECLARATION',
        line: index + 1,
        id,
        message: `${id || '未知编号'}不在当前事实包中。`,
      });
      return;
    }
    if (canonical && canonical !== expected) {
      declarationValid = false;
      issues.push({
        kind: 'DECLARATION',
        line: index + 1,
        id,
        message: `${id}没有逐字复制事实包，字段、顺序或方向已发生变化。`,
      });
      return;
    }
    if (declarationValid && currentEvidenceId) {
      validDeclarationCount += 1;
      validEvidenceIds.add(currentEvidenceId);
      resolvedEvidence.set(currentEvidenceId, {
        evidenceId: currentEvidenceId,
        factId: id,
        fact: expected,
      });
    }
  });

  if (!submittedEvidence.length) {
    issues.push({
      kind: 'DECLARATION',
      message: '回答中没有可核验的证据声明。请使用“一行一个E编号=事实编号”，例如“E01=Z054”。',
    });
    return {
      status: 'BLOCKED',
      question,
      referenceStatus: 'BLOCKED',
      closureStatus: question === 'Q6' ? 'BLOCKED' : 'NOT_CHECKED',
      roleStatus: 'NOT_CHECKED',
      sourceFactCount: sourceFacts.size,
      declarationCount: 0,
      validDeclarationCount: 0,
      referenceCount: 0,
      resolvedEvidence: [],
      closureRequired,
      closureCovered: [],
      missingClosure: closureRequired,
      caseId,
      fingerprint,
      issues,
    };
  }

  const narrativeEntries = answerLines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(item => !extractCanonicalFact(item.line) && !compactEvidence(item.line));
  const narrativeText = narrativeEntries.map(item => item.line).join('\n');
  const referencedEvidenceIds = Array.from(
    new Set((narrativeText.match(EVIDENCE_ID_PATTERN) || []).map(id => id.toUpperCase())),
  );
  const leakedFactIds = new Map<string, number>();
  narrativeEntries.forEach(item => {
    idsIn(item.line).forEach(id => {
      if (!leakedFactIds.has(id)) leakedFactIds.set(id, item.lineNumber);
    });
  });

  referencedEvidenceIds.forEach(id => {
    if (!validEvidenceIds.has(id)) {
      issues.push({
        kind: 'REFERENCE',
        id,
        message: `正文引用${id}，但没有同编号的有效证据声明。`,
      });
    }
  });

  leakedFactIds.forEach((lineNumber, id) => {
    issues.push({
      kind: 'REFERENCE',
      id,
      line: lineNumber,
      message: `正文直接出现盘面编号${id}；宫位或星曜名称可以保留，但编号请改为对应E编号。`,
    });
  });

  answerLines.forEach((line, index) => {
    if (extractCanonicalFact(line) || compactEvidence(line) || !TECHNICAL_RELATION_PATTERN.test(line)) return;
    issues.push({
      kind: 'NARRATIVE',
      line: index + 1,
      message: '正文重新口述了飞化、入冲、对宫、三合或向心离心关系；请保留课程解释，把技术关系改为“依据E编号”。',
    });
  });

  const closureCovered = closureRequired
    .filter(item => Array.from(resolvedEvidence.values()).some(evidence => evidence.factId === item.factId))
    .map(item => item.factId);
  const missingClosure = closureRequired.filter(item => !closureCovered.includes(item.factId));
  if (question === 'Q6' && !closureRequired.length) {
    issues.push({ kind: 'CLOSURE', message: '事实包中无法定位夫妻宫，问题6核心闭包不能执行。' });
  } else if (question === 'Q6' && missingClosure.length) {
    const grouped = missingClosure.reduce<Record<string, string[]>>((groups, item) => {
      groups[item.reason] = [...(groups[item.reason] || []), item.factId];
      return groups;
    }, {});
    Object.entries(grouped).forEach(([reason, ids]) => {
      issues.push({
        kind: 'CLOSURE',
        message: `问题6缺少${reason}：${ids.join('、')}。同一路径可以合并计数，但这些FACT必须登记并参与加减。`,
      });
    });
  }

  const referenceStatus: ValidationLayerStatus = issues.some(issue => issue.kind !== 'CLOSURE') ? 'BLOCKED' : 'PASS';
  const closureStatus: ValidationLayerStatus = question === 'Q6'
    ? issues.some(issue => issue.kind === 'CLOSURE') ? 'BLOCKED' : 'PASS'
    : 'NOT_CHECKED';

  return {
    status: issues.length ? 'BLOCKED' : 'PASS',
    question,
    referenceStatus,
    closureStatus,
    roleStatus: 'NOT_CHECKED',
    sourceFactCount: sourceFacts.size,
    declarationCount: submittedEvidence.length,
    validDeclarationCount,
    referenceCount: referencedEvidenceIds.length,
    resolvedEvidence: Array.from(resolvedEvidence.values()),
    closureRequired,
    closureCovered,
    missingClosure,
    caseId,
    fingerprint,
    issues,
  };
}

export function formatFactValidationResult(result: FactValidationResult): string {
  const questionLabel = result.question === 'AUTO' ? '自动识别失败或未选择' : `问题${result.question.slice(1)}`;
  const closureLabel = result.closureStatus === 'NOT_CHECKED'
    ? '未启用（当前仅问题6已实现）'
    : result.closureStatus;
  const lines = [
    `核验结论：${result.status === 'BLOCKED' ? 'BLOCKED' : result.closureStatus === 'PASS' ? '引用与核心闭包通过' : '引用通过'}`,
    `当前题目：${questionLabel}`,
    `引用核验：${result.referenceStatus}`,
    `核心闭包：${closureLabel}`,
    '语义角色：待人工审查（网页尚未自动判断）',
    `事实源：${result.sourceFactCount}项`,
    `证据声明：${result.validDeclarationCount}/${result.declarationCount}有效`,
    `正文编号：${result.referenceCount}项`,
    `网页还原：${result.resolvedEvidence.length}项`,
  ];
  if (!result.issues.length) {
    lines.push('', result.closureStatus === 'PASS'
      ? `引用与问题6核心闭包均通过，共覆盖${result.closureCovered.length}/${result.closureRequired.length}项。仍需人工审查语义角色与技法解释。`
      : '本轮仅证明引用格式与编号还原通过；未自动证明证据取全、语义角色正确或论命结论成立。');
    if (result.resolvedEvidence.length) {
      lines.push('', '网页还原证据：');
      result.resolvedEvidence.forEach(item => {
        lines.push(`${item.evidenceId} -> ${item.fact}`);
      });
    }
    if (result.question !== 'AUTO') {
      const currentNumber = Number(result.question.slice(1));
      const nextNumber = currentNumber < 12 ? currentNumber + 1 : null;
      if (nextNumber) {
        const webStatus = result.closureStatus === 'PASS' ? '引用与核心闭包PASS' : '引用PASS';
        lines.push(
          '',
          '下一题状态回执：',
          `CASE=${result.caseId} | FP=${result.fingerprint} | PREVIOUS_Q=${currentNumber} | WEB_STATUS=${webStatus} | CURRENT_Q=${nextNumber} | ENABLED_SOURCE_SET=事实包+问题${nextNumber}指定课程`,
        );
      }
    }
    return lines.join('\n');
  }
  const kindNames: Record<FactValidationIssueKind, string> = {
    INPUT: '提交范围',
    SOURCE: '事实源',
    DECLARATION: '证据声明',
    REFERENCE: '正文引用',
    NARRATIVE: '技术复述',
    CLOSURE: '核心闭包',
  };
  const kindCounts = result.issues.reduce<Record<FactValidationIssueKind, number>>(
    (counts, issue) => ({ ...counts, [issue.kind]: counts[issue.kind] + 1 }),
    { INPUT: 0, SOURCE: 0, DECLARATION: 0, REFERENCE: 0, NARRATIVE: 0, CLOSURE: 0 },
  );
  const groupedSummary = (Object.keys(kindCounts) as FactValidationIssueKind[])
    .filter(kind => kindCounts[kind] > 0)
    .map(kind => `${kindNames[kind]}${kindCounts[kind]}项`)
    .join('，');
  lines.push('', `发现${result.issues.length}项阻断：`);
  lines.push(`阻断分类：${groupedSummary}`, '');
  result.issues.forEach((issue, index) => {
    const location = issue.line ? `第${issue.line}行` : '全文';
    lines.push(`${index + 1}. [${issue.kind}] ${location} ${issue.message}`);
  });
  return lines.join('\n');
}

export function getMissingEvidenceReferenceIds(result: FactValidationResult): string[] {
  return Array.from(new Set(
    result.issues
      .filter(issue => (
        issue.kind === 'REFERENCE'
        && /^E\d{2,3}$/i.test(issue.id || '')
        && issue.message.includes('没有同编号的有效证据声明')
      ))
      .map(issue => issue.id!.toUpperCase()),
  ));
}

export function repairLeakedFactReferences(
  answer: string,
  result: FactValidationResult,
): InlineReferenceRepairResult {
  const leakedFactIds = Array.from(new Set(
    result.issues
      .filter(issue => (
        issue.kind === 'REFERENCE'
        && !!issue.id
        && issue.message.includes('正文直接出现盘面编号')
      ))
      .map(issue => issue.id!.toUpperCase()),
  ));
  const evidenceByFact = new Map<string, string[]>();
  result.resolvedEvidence.forEach(({ evidenceId, factId }) => {
    const normalizedFactId = factId.toUpperCase();
    evidenceByFact.set(normalizedFactId, [
      ...(evidenceByFact.get(normalizedFactId) || []),
      evidenceId.toUpperCase(),
    ]);
  });

  const replacements: InlineReferenceRepairResult['replacements'] = [];
  const unresolvedFactIds: string[] = [];
  const replacementMap = new Map<string, string>();
  leakedFactIds.forEach(id => {
    const evidenceIds = Array.from(new Set(evidenceByFact.get(id) || []));
    if (!evidenceIds.length) {
      unresolvedFactIds.push(id);
      return;
    }
    replacementMap.set(id, evidenceIds[0]);
  });

  const counts = new Map<string, number>();
  const repairedAnswer = answer
    .split(/\r?\n/)
    .map(line => {
      if (extractCanonicalFact(line) || compactEvidence(line)) return line;
      let repairedLine = line;
      Array.from(replacementMap.entries())
        .sort(([left], [right]) => right.length - left.length)
        .forEach(([factId, evidenceId]) => {
          const escapedId = factId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tokenPattern = new RegExp(`(^|[^A-Za-z0-9-])${escapedId}(?=$|[^A-Za-z0-9-])`, 'gi');
          repairedLine = repairedLine.replace(tokenPattern, (_match, prefix: string) => {
            counts.set(factId, (counts.get(factId) || 0) + 1);
            return `${prefix}${evidenceId}`;
          });
        });
      return repairedLine;
    })
    .join('\n');

  replacementMap.forEach((evidenceId, factId) => {
    const count = counts.get(factId) || 0;
    if (count) replacements.push({ factId, evidenceId, count });
    else unresolvedFactIds.push(factId);
  });

  return {
    repairedAnswer,
    replacements,
    unresolvedFactIds: Array.from(new Set(unresolvedFactIds)),
  };
}

export function buildEvidenceRepairPrompt(result: FactValidationResult): string {
  const missingIds = getMissingEvidenceReferenceIds(result);
  if (!missingIds.length) return '';
  const questionLabel = result.question === 'AUTO' ? '当前问题' : `问题${result.question.slice(1)}`;
  const lineExamples = missingIds.map(id => `${id}=对应FACT编号`).join('\n');
  return [
    `这是${questionLabel}的网页补证修复，不是下一道问题，也不重新执行问题0。`,
    `网页确认原回答正文引用了${missingIds.join('、')}，但末尾缺少对应FACT映射。`,
    '',
    '请回查你刚才的完整回答和当前[LOCKED-FACTS]事实包，只补充这些缺失编号。',
    '每行严格使用“E编号=FACT编号”，不要解释、不要重写正文、不要改变其他E编号。',
    '如果某个E编号无法找到直接FACT依据，请输出“无法绑定:E编号”，不得猜测。',
    '',
    '应返回的行：',
    lineExamples,
  ].join('\n');
}

export function mergeEvidencePatch(
  answer: string,
  patchText: string,
  requiredEvidenceIds: string[],
): EvidencePatchMergeResult {
  const required = new Set(requiredEvidenceIds.map(id => id.toUpperCase()));
  const accepted = new Map<string, string>();
  const conflicted = new Set<string>();
  const rejectedLines: string[] = [];

  const matches = Array.from(patchText.matchAll(PATCH_EVIDENCE_PATTERN));
  matches.forEach(match => {
    const evidenceId = match[1].toUpperCase();
    const id = match[2].toUpperCase();
    if (!required.has(evidenceId)) {
      rejectedLines.push(match[0]);
      return;
    }
    const previous = accepted.get(evidenceId);
    if (previous && previous !== id) {
      accepted.delete(evidenceId);
      conflicted.add(evidenceId);
      rejectedLines.push(match[0]);
      return;
    }
    if (!conflicted.has(evidenceId)) {
      accepted.set(evidenceId, id);
    }
  });

  const acceptedLines = Array.from(accepted.entries()).map(([evidenceId, id]) => `${evidenceId}=${id}`);
  const missingEvidenceIds = requiredEvidenceIds.filter(id => !accepted.has(id.toUpperCase()));
  const trimmedAnswer = answer.trimEnd();
  const mergedAnswer = acceptedLines.length
    ? `${trimmedAnswer}\n${acceptedLines.join('\n')}`
    : answer;

  return {
    mergedAnswer,
    acceptedLines,
    missingEvidenceIds,
    rejectedLines,
  };
}
