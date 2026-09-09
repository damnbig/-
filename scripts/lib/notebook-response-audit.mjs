import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

let validatorPromise;

const loadValidator = async () => {
  if (!validatorPromise) {
    validatorPromise = (async () => {
      const bundle = await build({
        entryPoints: ['services/ziweiFactValidator.ts'],
        bundle: true,
        format: 'esm',
        platform: 'node',
        write: false,
      });
      const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`;
      return import(moduleUrl);
    })();
  }
  return validatorPromise;
};

export const extractNotebookAnswer = (pageText, stepId) => {
  const questionMatch = stepId.match(/^Q(\d+)(B?)$/);
  const questionLabel = questionMatch ? `${questionMatch[1]}${questionMatch[2]}` : null;
  const answerEndMarkers = ['\nkeep_pin', '\n保存到笔记', '\ncheck_box_outline_blank'];
  const turnStarts = [...pageText.matchAll(/^Thoughts\r?\nexpand_more\r?\n/gm)]
    .map(match => match.index + match[0].length);
  const candidateMatchesStep = candidate => {
    if (stepId === 'Q0') return /MODE0_STATUS\s*=\s*PASS|NotebookLM事实包会话锁已建立/.test(candidate);
    if (questionLabel) {
      return new RegExp(`(?:^问题${questionLabel}[：:]|\\bC${questionLabel}-\\d+\\b|CURRENT_Q\\s*=\\s*${questionLabel}\\b)`, 'm').test(candidate);
    }
    return candidate.includes(stepId);
  };
  for (const answerStart of turnStarts.reverse()) {
    const answerEndCandidates = answerEndMarkers
      .map(marker => pageText.indexOf(marker, answerStart))
      .filter(index => index >= 0);
    if (!answerEndCandidates.length) continue;
    const candidate = pageText.slice(answerStart, Math.min(...answerEndCandidates)).trim();
    if (candidate.length >= 80 && candidateMatchesStep(candidate)) return candidate;
  }

  // When explicit assistant-turn boundaries exist, a prompt mentioning a future
  // checkpoint must never become a fallback answer for that checkpoint.
  if (turnStarts.length) throw new Error(`Cannot find a completed ${stepId} assistant turn`);
  const escapedStepId = stepId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = questionLabel
    ? new RegExp(`^问题${questionLabel}[：:]`, 'gm')
    : new RegExp(`^.*${escapedStepId}.*$`, 'gm');
  const starts = [...pageText.matchAll(headingPattern)].map(match => match.index);
  if (!starts.length) throw new Error(`Cannot find the ${stepId} answer heading`);

  const answerStart = starts.at(-1);
  const answerEndCandidates = answerEndMarkers
    .map(marker => pageText.indexOf(marker, answerStart))
    .filter(index => index >= 0);
  const answerEnd = answerEndCandidates.length ? Math.min(...answerEndCandidates) : pageText.length;
  return pageText.slice(answerStart, answerEnd).trim();
};

const findEvidenceHeadingIndex = answer => {
  const matches = [...answer.matchAll(/^.*证据登记.*$/gm)];
  return matches.at(-1)?.index ?? -1;
};

export const normalizeEvidenceBlock = rawAnswer => {
  const evidenceHeading = findEvidenceHeadingIndex(rawAnswer);
  if (evidenceHeading < 0) return rawAnswer;
  const body = rawAnswer.slice(0, evidenceHeading).trimEnd();
  const evidence = rawAnswer.slice(evidenceHeading).match(/E\d+=[A-Z]+\d+(?:-[A-Z]\d*)?/g) ?? [];
  return `${body}\n\n证据登记\n${evidence.join('\n')}`;
};

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const confirmsAllChecksPass = rawAnswer => [
  /(?:所有|全部)[^\n]{0,80}(?:CHECK|TYPE=CHECK)[^\n]{0,80}PASS/i,
  /(?:CHECK|TYPE=CHECK)[^\n]{0,120}(?:全部|均|全数)[^\n]{0,24}PASS/i,
].some(pattern => pattern.test(rawAnswer));

export const repairMappedFactReferences = answer => {
  const evidenceHeading = findEvidenceHeadingIndex(answer);
  if (evidenceHeading < 0) return { answer, repairs: [] };
  const body = answer.slice(0, evidenceHeading);
  const evidence = answer.slice(evidenceHeading);
  const factToEvidence = new Map();
  for (const match of evidence.matchAll(/\b(E\d+)=([A-Z]+\d+(?:-[A-Z]\d*)?)/g)) {
    const [, evidenceId, factId] = match;
    const ids = factToEvidence.get(factId) ?? new Set();
    ids.add(evidenceId);
    factToEvidence.set(factId, ids);
  }

  let repairedBody = body;
  const repairs = [];
  const canonicalMappings = [...factToEvidence.entries()]
    .map(([factId, ids]) => [
      factId,
      [...ids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0],
    ])
    .sort((a, b) => b[0].length - a[0].length);
  for (const [factId, evidenceId] of canonicalMappings) {
    const pattern = new RegExp(`(?<![A-Z0-9-])${escapeRegExp(factId)}(?![A-Z0-9-])`, 'g');
    const matches = repairedBody.match(pattern)?.length ?? 0;
    if (!matches) continue;
    repairedBody = repairedBody.replace(pattern, evidenceId);
    repairs.push({ factId, evidenceId, count: matches });
  }
  return { answer: `${repairedBody}${evidence}`, repairs };
};

export const bindUndeclaredFactReferences = (answer, notebookFacts) => {
  const evidenceHeading = findEvidenceHeadingIndex(answer);
  if (evidenceHeading < 0) return { answer, bindings: [] };
  const sourceFactIds = new Set(
    [...notebookFacts.matchAll(/^FACT\|([^|]+)\|/gm)].map(match => match[1]),
  );
  const declaredMappings = [...answer.matchAll(/\b(E\d+)=([A-Z]+\d+(?:-[A-Z]\d*)?)/g)];
  const declaredFacts = new Set(declaredMappings.map(match => match[2]));
  let nextEvidenceNumber = Math.max(0, ...declaredMappings.map(match => Number(match[1].slice(1)))) + 1;
  const evidenceNumberWidth = Math.max(
    2,
    ...declaredMappings.map(match => match[1].slice(1).length),
  );
  const body = answer.slice(0, evidenceHeading);
  const evidence = answer.slice(evidenceHeading).trimEnd();
  const bindings = [];
  for (const factId of [...sourceFactIds].sort((a, b) => b.length - a.length)) {
    if (declaredFacts.has(factId)) continue;
    const pattern = new RegExp(`(?<![A-Z0-9-])${escapeRegExp(factId)}(?![A-Z0-9-])`);
    if (!pattern.test(body)) continue;
    const evidenceId = `E${String(nextEvidenceNumber++).padStart(evidenceNumberWidth, '0')}`;
    declaredFacts.add(factId);
    bindings.push({ factId, evidenceId });
  }
  if (!bindings.length) return { answer, bindings };
  return {
    answer: `${body}${evidence}\n${bindings.map(item => `${item.evidenceId}=${item.factId}`).join('\n')}`,
    bindings,
  };
};

export const auditQuestionPage = async ({ pagePath, factsPath, stepId }) => {
  const pageText = await readFile(pagePath, 'utf8');
  const notebookFacts = await readFile(factsPath, 'utf8');
  const rawAnswer = extractNotebookAnswer(pageText, stepId);
  if (stepId === 'Q0') {
    const factLines = [...notebookFacts.matchAll(/^FACT\|([^|]+)\|TYPE=([^|]+)\|CASE=([^|]+)\|FP=([^|]+)/gm)];
    const caseId = factLines[0]?.[3] ?? '';
    const fingerprint = factLines[0]?.[4] ?? '';
    const counts = new Map();
    for (const match of factLines) counts.set(match[2], (counts.get(match[2]) ?? 0) + 1);
    const issues = [];
    if (!caseId || !rawAnswer.includes(caseId)) {
      issues.push({ kind: 'ADMISSION', message: '问题0没有登记当前案例编号。' });
    }
    if (!fingerprint || !rawAnswer.includes(fingerprint)) {
      issues.push({ kind: 'ADMISSION', message: '问题0没有登记当前盘面指纹。' });
    }
    if (!new RegExp(`事实总数[^\n]{0,30}${factLines.length}`).test(rawAnswer)) {
      issues.push({ kind: 'ADMISSION', message: `问题0没有登记正确的事实总数${factLines.length}。` });
    }
    for (const [type, count] of counts) {
      if (!new RegExp(`${escapeRegExp(type)}[^\n]{0,40}${count}`).test(rawAnswer)) {
        issues.push({ kind: 'ADMISSION', message: `问题0没有登记${type}=${count}。` });
      }
    }
    if (!confirmsAllChecksPass(rawAnswer)) {
      issues.push({ kind: 'ADMISSION', message: '问题0没有确认全部CHECK均为PASS。' });
    }
    if (!rawAnswer.includes('NotebookLM事实包会话锁已建立，可以进入问题1。')) {
      issues.push({ kind: 'ADMISSION', message: '问题0缺少会话锁完成语句。' });
    }
    const result = {
      status: issues.length ? 'BLOCKED' : 'PASS',
      question: stepId,
      referenceStatus: 'NOT_APPLICABLE',
      closureStatus: 'NOT_CHECKED',
      roleStatus: 'NOT_CHECKED',
      sourceFactCount: factLines.length,
      declarationCount: 0,
      validDeclarationCount: 0,
      referenceCount: 0,
      resolvedEvidence: [],
      caseId,
      fingerprint,
      issues,
      autoRepairs: [],
      autoBindings: [],
    };
    const basePath = pagePath.replace(/-page\.txt$/i, '');
    const answerPath = `${basePath}-answer.txt`;
    const normalizedPath = `${basePath}-normalized.txt`;
    const auditPath = `${basePath}-audit.json`;
    await writeFile(answerPath, rawAnswer, 'utf8');
    await writeFile(normalizedPath, rawAnswer, 'utf8');
    await writeFile(auditPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    return { result, rawAnswer, normalizedAnswer: rawAnswer, answerPath, normalizedPath, auditPath };
  }
  const evidenceNormalized = normalizeEvidenceBlock(rawAnswer);
  const bound = bindUndeclaredFactReferences(evidenceNormalized, notebookFacts);
  const repaired = repairMappedFactReferences(bound.answer);
  const normalizedAnswer = repaired.answer;
  const { validateNotebookAnswer } = await loadValidator();
  const result = validateNotebookAnswer(normalizedAnswer, notebookFacts, stepId);
  result.autoRepairs = repaired.repairs;
  result.autoBindings = bound.bindings;

  const basePath = pagePath.replace(/-page\.txt$/i, '');
  const answerPath = `${basePath}-answer.txt`;
  const normalizedPath = `${basePath}-normalized.txt`;
  const auditPath = `${basePath}-audit.json`;
  await writeFile(answerPath, rawAnswer, 'utf8');
  await writeFile(normalizedPath, normalizedAnswer, 'utf8');
  await writeFile(auditPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return { result, rawAnswer, normalizedAnswer, answerPath, normalizedPath, auditPath };
};

export const auditCheckpointPage = async ({ pagePath, stepId }) => {
  const pageText = await readFile(pagePath, 'utf8');
  const rawAnswer = extractNotebookAnswer(pageText, stepId);
  const getStatusSection = token => {
    const tokenIndex = rawAnswer.indexOf(token);
    if (tokenIndex < 0) return null;
    const rest = rawAnswer.slice(tokenIndex + token.length);
    const nextSection = rest.search(/\n(?:[一二三四五六七八九十]+、|\d+[.、])\s*/);
    return nextSection >= 0 ? rest.slice(0, nextSection) : rest;
  };
  const sectionIsExplicitlyEmpty = section => section != null
    && /(?:本轮)?\s*(?:无|没有|未发现)\s*(?:任何)?[“”"']?(?:待核来源|范围受限|阻断)?[“”"']?\s*(?:结论|项目|项)?/i.test(section);
  const issues = [];
  for (const token of ['PENDING_SOURCE', 'SCOPE_BLOCKED']) {
    const section = getStatusSection(token);
    if (section == null) {
      issues.push({ kind: 'CHECKPOINT', message: `${stepId} does not report ${token}` });
    } else if (!sectionIsExplicitlyEmpty(section)) {
      issues.push({ kind: 'CHECKPOINT', message: `${stepId} contains non-empty ${token}` });
    }
  }
  if (/\bBLOCKED\b/i.test(rawAnswer)) {
    issues.push({ kind: 'CHECKPOINT', message: `${stepId} contains BLOCKED` });
  }
  const result = { status: issues.length ? 'BLOCKED' : 'PASS', stepId, issues };

  const basePath = pagePath.replace(/-page\.txt$/i, '');
  const answerPath = `${basePath}-answer.txt`;
  const auditPath = `${basePath}-audit.json`;
  await writeFile(answerPath, rawAnswer, 'utf8');
  await writeFile(auditPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return { result, rawAnswer, answerPath, auditPath };
};
