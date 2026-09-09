import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { astro } from 'iztro';
import { Lunar, Solar } from 'lunar-javascript';

const bundled = await build({
  entryPoints: ['services/ziweiLedger.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`;
const { generateLockedZiweiLedger } = await import(moduleUrl);

const validatorBundled = await build({
  entryPoints: ['services/ziweiFactValidator.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const validatorModuleUrl = `data:text/javascript;base64,${Buffer.from(validatorBundled.outputFiles[0].contents).toString('base64')}`;
const {
  buildEvidenceRepairPrompt,
  getMissingEvidenceReferenceIds,
  mergeEvidencePatch,
  repairLeakedFactReferences,
  validateNotebookAnswer,
} = await import(validatorModuleUrl);

const EXPECTED_SIHUA = {
  甲: { L: '廉贞', Q: '破军', K: '武曲', J: '太阳' },
  乙: { L: '天机', Q: '天梁', K: '紫微', J: '太阴' },
  丙: { L: '天同', Q: '天机', K: '文昌', J: '廉贞' },
  丁: { L: '太阴', Q: '天同', K: '天机', J: '巨门' },
  戊: { L: '贪狼', Q: '太阴', K: '右弼', J: '天机' },
  己: { L: '武曲', Q: '贪狼', K: '天梁', J: '文曲' },
  庚: { L: '太阳', Q: '武曲', K: '太阴', J: '天同' },
  辛: { L: '巨门', Q: '太阳', K: '文曲', J: '文昌' },
  壬: { L: '天梁', Q: '紫微', K: '左辅', J: '武曲' },
  癸: { L: '破军', Q: '巨门', K: '太阴', J: '贪狼' },
};

const EXPECTED_RELATIONS = {
  子: ['午', '辰', '申'],
  丑: ['未', '巳', '酉'],
  寅: ['申', '午', '戌'],
  卯: ['酉', '未', '亥'],
  辰: ['戌', '申', '子'],
  巳: ['亥', '酉', '丑'],
  午: ['子', '戌', '寅'],
  未: ['丑', '亥', '卯'],
  申: ['寅', '子', '辰'],
  酉: ['卯', '丑', '巳'],
  戌: ['辰', '寅', '午'],
  亥: ['巳', '卯', '未'],
};

const HUA_BY_CODE = { L: '禄', Q: '权', K: '科', J: '忌' };

const parseLedgerRows = markdown => markdown
  .split('\n')
  .filter(line => /^\| (?:B|Z|R|F|S|D|DA)/.test(line))
  .map(line => line.split('|').slice(1, -1).map(value => value.trim()));

const assertAtomicFacts = result => {
  const rows = parseLedgerRows(result.markdown);
  const branchByPalace = new Map(
    rows.filter(row => /^B\d{2}$/.test(row[0])).map(row => [row[0], row[2].slice(-1)]),
  );
  const stemByPalace = new Map(
    rows.filter(row => /^B\d{2}$/.test(row[0])).map(row => [row[0], row[2].charAt(0)]),
  );
  const oppositeByPalace = new Map(
    rows.filter(row => /^R\d{2}$/.test(row[0])).map(row => [row[1], row[4]]),
  );
  const flyIdByPalace = new Map(
    rows.filter(row => /^F\d{2}$/.test(row[0])).map(row => [row[1], row[0]]),
  );

  const relationRows = rows.filter(row => /^R\d{2}$/.test(row[0]));
  assert.equal(relationRows.length, 12);
  for (const row of relationRows) {
    const expected = EXPECTED_RELATIONS[row[3]];
    const actual = [branchByPalace.get(row[4]), branchByPalace.get(row[5]), branchByPalace.get(row[6])];
    assert.equal(actual[0], expected[0]);
    assert.deepEqual(new Set(actual.slice(1)), new Set(expected.slice(1)));
  }

  const markedStarRows = rows.filter(row => /^Z\d{3}$/.test(row[0]) && ['主星', '辅星'].includes(row[3]));
  const palaceByStar = new Map(markedStarRows.map(row => [row[4], row[1]]));
  const atomicTransformRows = rows.filter(row => /^(?:F\d{2}|D0[1-3]|DA\d{2})-[LQKJ]$/.test(row[0]));
  for (const row of atomicTransformRows) {
    const code = row[0].slice(-1);
    assert.equal(row[6], EXPECTED_SIHUA[row[4]][code]);
    assert.equal(row[7], palaceByStar.get(row[6]));
  }

  const expectedSelfHua = [];
  for (const row of markedStarRows) {
    const targetId = row[1];
    const sourceId = oppositeByPalace.get(targetId);
    for (const [code, star] of Object.entries(EXPECTED_SIHUA[stemByPalace.get(targetId)])) {
      if (star === row[4]) {
        expectedSelfHua.push([
          targetId,
          targetId,
          HUA_BY_CODE[code],
          star,
          '离心',
          targetId,
          flyIdByPalace.get(targetId),
        ].join('|'));
      }
    }
    for (const [code, star] of Object.entries(EXPECTED_SIHUA[stemByPalace.get(sourceId)])) {
      if (star === row[4]) {
        expectedSelfHua.push([
          targetId,
          sourceId,
          HUA_BY_CODE[code],
          star,
          '向心',
          targetId,
          flyIdByPalace.get(sourceId),
        ].join('|'));
      }
    }
  }
  const actualSelfHua = rows
    .filter(row => /^S\d{2}$/.test(row[0]))
    .map(row => row.slice(1).join('|'));
  assert.deepEqual(actualSelfHua.sort(), expectedSelfHua.sort());
};

const birthDate = new Date(1998, 8, 26, 16, 20);
const reportDate = new Date(2026, 7, 17, 12, 0);
const birthSolar = Solar.fromYmdHms(1998, 9, 26, 16, 20, 0);
const birthLunar = birthSolar.getLunar();
const reportLunar = Lunar.fromDate(reportDate);
const astrolabe = astro.bySolar('1998-9-26', 8, '女', true, 'zh-CN');

const makeLedger = (overrides = {}) => generateLockedZiweiLedger({
  astrolabe,
  caseId: 'CASE-LEDGER-REGRESSION',
  gender: '女',
  birthDate,
  reportDate,
  lunarText: birthLunar.toString(),
  ...overrides,
});

const valid = makeLedger();
assert.equal(valid.status, 'PASS', valid.issues.join('；'));
assert.match(valid.markdown, /> 生成器：iZiwei Deterministic Ledger v4\.1/);
assert.match(valid.markdown, /\| Z074 \| B12 \| 父母宫 \| 将前十二神 \| 指背 \| — \| — \| — \| — \|/);
assert.match(valid.markdown, /\| R05 \| B05 \| 财帛宫 \| 酉 \| B11 \| B01 \| B09 \|/);
assert.match(valid.markdown, /\| R11 \| B11 \| 福德宫 \| 卯 \| B05 \| B07 \| B03 \|/);
assert.match(valid.markdown, /\| F11-K \| F11 \| 本命宫干飞化 \| B11 \| 乙 \| 科 \| 紫微 \| B09 \|/);
assert.match(valid.markdown, /\| D03-K \| D03 \| 报告流年四化 \| M10 \| 丙 \| 科 \| 文昌 \| B12 \|/);
assert.match(valid.markdown, /\| DA03-J \| DA03 \| 24-33岁大限四化 \| B03 \| 癸 \| 忌 \| 贪狼 \| B01 \|/);
assert.match(valid.markdown, /\| D03 \| 报告流年四化 \| M10 \| 丙 \| 天同→B02 \| 天机→B10 \| 文昌→B12 \| 廉贞→B05 \|/);
assert.match(valid.markdown, /\| DA01 \| 已历 \| 4-13 \| B01 \| 命宫 \| 乙丑 \|/);
assert.match(valid.markdown, /\| DA02 \| 已历 \| 14-23 \| B02 \| 兄弟宫 \| 甲子 \|/);
assert.match(valid.markdown, /\| DA03 \| 当前 \| 24-33 \| B03 \| 夫妻宫 \| 癸亥 \| 破军→B05 \| 巨门→B12 \| 太阴→B02 \| 贪狼→B01 \|/);
assert.match(valid.markdown, /\| DA04 \| 下一限 \| 34-43 \| B04 \| 子女宫 \| 壬戌 \|/);
assert.match(valid.markdown, /\| DA03-L01 \| 大限命宫 \| B03 \| 夫妻宫 \| 癸亥 \|/);
assert.match(valid.markdown, /\| DA03-L09 \| 大限官禄宫 \| B11 \| 福德宫 \| 乙卯 \|/);
assert.match(valid.markdown, /\| LY01 \| 流年命宫 \| B08 \| 仆役宫 \| 戊午 \|/);
assert.match(valid.markdown, /\| LY09 \| 流年官禄宫 \| B04 \| 子女宫 \| 壬戌 \|/);
assert.match(valid.markdown, /\| M11 \| 报告日期 \| 2026-08-17 \|/);
assert.match(valid.markdown, /- 流年十二宫叠宫：12\/12/);
assert.match(valid.markdown, /- 大限事实组：4组（48\/48个叠宫）/);
assert.match(valid.markdown, /- 宫位关系原子事实：12\/12/);
assert.match(valid.markdown, /- 四化原子事实：76\/76/);
assert.doesNotMatch(valid.markdown, /\| FAIL \|/);
assertAtomicFacts(valid);
assert.match(valid.notebookFacts, /> 生成器：iZiwei Notebook Fact Pack v1/);
assert.match(valid.notebookFacts, /> 来源台账：iZiwei Deterministic Ledger v4\.1/);
assert.equal(
  valid.notebookFacts.split('\n').filter(line => line.startsWith('FACT|')).length,
  valid.factCount,
);
assert.match(valid.notebookFacts, /FACT\|R05\|TYPE=RELATION\|CASE=CASE-LEDGER-REGRESSION\|FP=[A-F0-9]+\|SELF=B05\|PALACE_NAME=财帛宫\|BRANCH=酉\|OPPOSITE=B11\|TRINE_1=B01\|TRINE_2=B09/);
assert.match(valid.notebookFacts, /FACT\|F11-K\|TYPE=TRANSFORM\|CASE=CASE-LEDGER-REGRESSION\|FP=[A-F0-9]+\|PARENT=F11\|LAYER=本命宫干飞化\|SOURCE=B11\|SOURCE_STEM=乙\|HUA=科\|STAR=紫微\|TARGET=B09/);

const factLines = valid.notebookFacts.split('\n').filter(line => line.startsWith('FACT|'));
const relationFact = factLines.find(line => line.startsWith('FACT|R05|'));
const incomingFact = factLines.find(line => line.includes('|TYPE=SELF_HUA|') && line.includes('|DIRECTION=向心|'));
const f12JFact = factLines.find(line => line.startsWith('FACT|F12-J|'));
assert.ok(relationFact && incomingFact && f12JFact);
const incomingFactId = incomingFact.split('|')[1];

const correctAnswer = [
  `E01：${relationFact}`,
  `E02：${incomingFact}`,
  '依据E01与E02，这两条结构可以进入课程解释。',
].join('\n');
assert.equal(validateNotebookAnswer(correctAnswer, valid.notebookFacts).status, 'PASS');
const compactAnswer = [
  'E01=R05',
  `E02=${incomingFactId}`,
  '依据E01与E02，这两条结构可以进入课程解释。',
].join('\n');
const compactResult = validateNotebookAnswer(compactAnswer, valid.notebookFacts);
assert.equal(compactResult.status, 'PASS');
assert.equal(compactResult.resolvedEvidence.length, 2);
assert.equal(compactResult.resolvedEvidence[0].factId, 'R05');
assert.equal(compactResult.referenceStatus, 'PASS');
assert.equal(compactResult.closureStatus, 'NOT_CHECKED');

const missingEvidenceAnswer = 'E01=R05\n依据E01与E09进入课程解释。';
const missingEvidenceResult = validateNotebookAnswer(missingEvidenceAnswer, valid.notebookFacts, 'Q3');
assert.equal(missingEvidenceResult.status, 'BLOCKED');
assert.deepEqual(getMissingEvidenceReferenceIds(missingEvidenceResult), ['E09']);
assert.ok(buildEvidenceRepairPrompt(missingEvidenceResult).includes('E09=对应FACT编号'));
const evidencePatch = mergeEvidencePatch(
  missingEvidenceAnswer,
  `补充如下：\nE09=${incomingFactId}`,
  getMissingEvidenceReferenceIds(missingEvidenceResult),
);
assert.deepEqual(evidencePatch.acceptedLines, [`E09=${incomingFactId}`]);
assert.deepEqual(evidencePatch.missingEvidenceIds, []);
assert.equal(validateNotebookAnswer(evidencePatch.mergedAnswer, valid.notebookFacts, 'Q3').status, 'PASS');
const incompleteEvidencePatch = mergeEvidencePatch(missingEvidenceAnswer, '无法绑定:E09', ['E09']);
assert.deepEqual(incompleteEvidencePatch.acceptedLines, []);
assert.deepEqual(incompleteEvidencePatch.missingEvidenceIds, ['E09']);
const inlineEvidencePatch = mergeEvidencePatch(
  '依据E27与E23进入解释。',
  '核验项如下：E27=M02 E23=M03，请复核。',
  ['E27', 'E23'],
);
assert.deepEqual(inlineEvidencePatch.acceptedLines, ['E27=M02', 'E23=M03']);
assert.deepEqual(inlineEvidencePatch.missingEvidenceIds, []);
assert.equal(validateNotebookAnswer(inlineEvidencePatch.mergedAnswer, valid.notebookFacts, 'Q4').status, 'PASS');

const relationshipClosureProbe = validateNotebookAnswer('E01=R03', valid.notebookFacts, 'Q6');
assert.equal(relationshipClosureProbe.status, 'BLOCKED');
assert.equal(relationshipClosureProbe.referenceStatus, 'PASS');
assert.equal(relationshipClosureProbe.closureStatus, 'BLOCKED');
assert.ok(relationshipClosureProbe.closureRequired.length > 4);
assert.ok(
  relationshipClosureProbe.closureRequired.some(item => item.factId === 'F03-K'),
  '问题6闭包必须包含夫妻宫化科原子事实',
);
assert.ok(
  relationshipClosureProbe.closureRequired.some(item => item.factId === 'F03-J'),
  '问题6闭包必须包含夫妻宫化忌原子事实',
);
const relationshipClosureAnswer = relationshipClosureProbe.closureRequired
  .map((item, index) => `E${String(index + 1).padStart(2, '0')}=${item.factId}`)
  .join('\n');
const relationshipClosurePass = validateNotebookAnswer(relationshipClosureAnswer, valid.notebookFacts, 'Q6');
assert.equal(relationshipClosurePass.status, 'PASS');
assert.equal(relationshipClosurePass.referenceStatus, 'PASS');
assert.equal(relationshipClosurePass.closureStatus, 'PASS');
assert.equal(relationshipClosurePass.missingClosure.length, 0);
const relationshipWithoutKe = relationshipClosureProbe.closureRequired
  .filter(item => item.factId !== 'F03-K')
  .map((item, index) => `E${String(index + 1).padStart(2, '0')}=${item.factId}`)
  .join('\n');
const relationshipWithoutKeResult = validateNotebookAnswer(relationshipWithoutKe, valid.notebookFacts, 'Q6');
assert.equal(relationshipWithoutKeResult.referenceStatus, 'PASS');
assert.equal(relationshipWithoutKeResult.closureStatus, 'BLOCKED');
assert.deepEqual(relationshipWithoutKeResult.missingClosure.map(item => item.factId), ['F03-K']);
const wrongQuestionSelection = validateNotebookAnswer(`C6-01【关系主题】\n${relationshipClosureAnswer}`, valid.notebookFacts, 'Q5');
assert.equal(wrongQuestionSelection.status, 'BLOCKED');
assert.ok(wrongQuestionSelection.issues.some(issue => issue.kind === 'INPUT'));
const laterQuestionWithPriorConclusionReferences = validateNotebookAnswer(
  [
    '### C10-1【过去阶段主题】',
    '本节回答：该假设若不符合，将降低C1-2与C3-1的可信度。',
    'E01=R05',
    '本节依据E01。',
  ].join('\n'),
  valid.notebookFacts,
);
assert.equal(laterQuestionWithPriorConclusionReferences.question, 'Q10');
assert.equal(laterQuestionWithPriorConclusionReferences.status, 'PASS');
const genuinelyMixedQuestionAnswers = validateNotebookAnswer(
  [
    '### C10-1【过去阶段主题】',
    '本节回答：问题10结论。',
    '### C3-1【认知主题】',
    '本节回答：问题3结论。',
    'E01=R05',
    '本节依据E01。',
  ].join('\n'),
  valid.notebookFacts,
);
assert.equal(genuinelyMixedQuestionAnswers.status, 'BLOCKED');
assert.ok(genuinelyMixedQuestionAnswers.issues.some(issue => issue.kind === 'INPUT'));
assert.equal(validateNotebookAnswer('E01=Z999\n依据E01进入解释。', valid.notebookFacts).status, 'BLOCKED');
const repeatedSameEvidence = validateNotebookAnswer(
  'E01=R05\n依据E01进入解释。\nE01=R05\n本节继续依据E01。',
  valid.notebookFacts,
);
assert.equal(repeatedSameEvidence.status, 'PASS');
assert.equal(repeatedSameEvidence.declarationCount, 2);
assert.equal(repeatedSameEvidence.validDeclarationCount, 2);
assert.equal(repeatedSameEvidence.resolvedEvidence.length, 1);
const conflictingEvidence = validateNotebookAnswer('E01=R05\nE01=F12-J\n依据E01进入解释。', valid.notebookFacts);
assert.equal(conflictingEvidence.status, 'BLOCKED');
assert.ok(conflictingEvidence.issues.some(issue => issue.message.includes('前后绑定了不同事实')));
const leakedReferenceResult = validateNotebookAnswer('E01=R05\n正文直接引用R05。', valid.notebookFacts);
assert.equal(leakedReferenceResult.status, 'BLOCKED');
assert.ok(leakedReferenceResult.issues.some(issue => issue.kind === 'REFERENCE' && issue.line === 2));
const leakedReferenceRepair = repairLeakedFactReferences(
  'E01=R05\n正文直接引用R05。',
  leakedReferenceResult,
);
assert.deepEqual(leakedReferenceRepair.replacements, [{ factId: 'R05', evidenceId: 'E01', count: 1 }]);
assert.equal(leakedReferenceRepair.repairedAnswer, 'E01=R05\n正文直接引用E01。');
assert.equal(
  validateNotebookAnswer(leakedReferenceRepair.repairedAnswer, valid.notebookFacts).status,
  'PASS',
);
const unresolvedLeakedReference = validateNotebookAnswer('E01=R05\n正文直接引用B02。', valid.notebookFacts);
const unresolvedLeakedRepair = repairLeakedFactReferences(
  'E01=R05\n正文直接引用B02。',
  unresolvedLeakedReference,
);
assert.deepEqual(unresolvedLeakedRepair.replacements, []);
assert.deepEqual(unresolvedLeakedRepair.unresolvedFactIds, ['B02']);
const fullConversationResult = validateNotebookAnswer(
  `User: 问题1\n---\nModel:\n${correctAnswer}\n---\nUser: 问题2`,
  valid.notebookFacts,
);
assert.equal(fullConversationResult.status, 'BLOCKED');
assert.equal(fullConversationResult.issues.filter(issue => issue.kind === 'INPUT').length, 1);
const legacyEvidenceResult = validateNotebookAnswer('证据登记：E01：命宫B01坐某星。', valid.notebookFacts);
assert.equal(legacyEvidenceResult.status, 'BLOCKED');
assert.equal(legacyEvidenceResult.issues.filter(issue => issue.kind === 'DECLARATION').length, 1);
const blockedFactSource = valid.notebookFacts.replace('校验状态：PASS', '校验状态：BLOCKED');
const blockedSourceResult = validateNotebookAnswer(correctAnswer, blockedFactSource);
assert.equal(blockedSourceResult.status, 'BLOCKED');
assert.ok(blockedSourceResult.issues.some(issue => issue.kind === 'SOURCE'));
assert.equal(validateNotebookAnswer(relationFact, valid.notebookFacts).status, 'BLOCKED');
assert.equal(
  validateNotebookAnswer(`E01：${relationFact}\n依据E02进入课程解释。`, valid.notebookFacts).status,
  'BLOCKED',
);
assert.equal(
  validateNotebookAnswer(`E01：${relationFact}\n正文直接引用R05。`, valid.notebookFacts).status,
  'BLOCKED',
);

const incomingSource = incomingFact.match(/\|SOURCE=(B\d{2})\|/)?.[1];
const incomingTarget = incomingFact.match(/\|TARGET=(B\d{2})\|/)?.[1];
assert.ok(incomingSource && incomingTarget && incomingSource !== incomingTarget);
const reversedIncoming = incomingFact
  .replace(`|SOURCE=${incomingSource}|`, `|SOURCE=${incomingTarget}|`)
  .replace(`|TARGET=${incomingTarget}|`, `|TARGET=${incomingSource}|`);
const reversedResult = validateNotebookAnswer(`E01：${reversedIncoming}`, valid.notebookFacts);
assert.equal(reversedResult.status, 'BLOCKED');
assert.ok(reversedResult.issues.some(issue => issue.kind === 'DECLARATION'));

const wrongRelation = relationFact.replace('|OPPOSITE=B11|TRINE_1=B01|', '|OPPOSITE=B01|TRINE_1=B11|');
assert.equal(validateNotebookAnswer(`E01：${wrongRelation}`, valid.notebookFacts).status, 'BLOCKED');

const f12Target = f12JFact.match(/\|TARGET=(B\d{2})$/)?.[1];
assert.ok(f12Target);
const wrongF12J = f12JFact.replace(`|TARGET=${f12Target}`, `|TARGET=${f12Target === 'B06' ? 'B07' : 'B06'}`);
assert.equal(validateNotebookAnswer(`E01：${wrongF12J}`, valid.notebookFacts).status, 'BLOCKED');

const unstructuredAnswer = `E01：${relationFact}\nS08由B10飞入B04，属于向心科。`;
const unstructuredResult = validateNotebookAnswer(unstructuredAnswer, valid.notebookFacts);
assert.equal(unstructuredResult.status, 'BLOCKED');
assert.ok(unstructuredResult.issues.some(issue => issue.kind === 'NARRATIVE'));

const knownErrorFacts = [
  '# [LOCKED-FACTS] 已知错误回归包',
  '> 生成器：iZiwei Notebook Fact Pack v1',
  '> 校验状态：PASS',
  'FACT|S08|TYPE=SELF_HUA|CASE=CASE-KNOWN-ERRORS|FP=ABC123|SOURCE=B10|HUA=科|STAR=天机|TARGET=B04|DIRECTION=向心',
  'FACT|R04|TYPE=RELATION|CASE=CASE-KNOWN-ERRORS|FP=ABC123|SELF=B04|PALACE_NAME=子女宫|BRANCH=戌|OPPOSITE=B10|TRINE_1=B02|TRINE_2=B06',
  'FACT|R07|TYPE=RELATION|CASE=CASE-KNOWN-ERRORS|FP=ABC123|SELF=B07|PALACE_NAME=迁移宫|BRANCH=未|OPPOSITE=B01|TRINE_1=B03|TRINE_2=B11',
  'FACT|F12-J|TYPE=TRANSFORM|CASE=CASE-KNOWN-ERRORS|FP=ABC123|PARENT=F12|LAYER=本命宫干飞化|SOURCE=B12|SOURCE_STEM=丙|HUA=忌|STAR=廉贞|TARGET=B05',
].join('\n');
const knownErrorLines = knownErrorFacts.split('\n').filter(line => line.startsWith('FACT|'));
assert.equal(
  validateNotebookAnswer(`E01：${knownErrorLines[0].replace('|SOURCE=B10|', '|SOURCE=B04|').replace('|TARGET=B04|', '|TARGET=B10|')}`, knownErrorFacts).status,
  'BLOCKED',
);
assert.equal(
  validateNotebookAnswer(`E01：${knownErrorLines[1].replace('|OPPOSITE=B10|TRINE_1=B02|', '|OPPOSITE=B02|TRINE_1=B10|')}`, knownErrorFacts).status,
  'BLOCKED',
);
assert.equal(
  validateNotebookAnswer(`E01：${knownErrorLines[2].replace('|TRINE_2=B11', '|TRINE_2=B10')}`, knownErrorFacts).status,
  'BLOCKED',
);
assert.equal(
  validateNotebookAnswer(`E01：${knownErrorLines[3].replace('|TARGET=B05', '|TARGET=B06')}`, knownErrorFacts).status,
  'BLOCKED',
);

const makeNatalLedger = ({ year, month, day, hour, gender }) => {
  const profileBirthDate = new Date(year, month - 1, day, hour, 30);
  const profileSolar = Solar.fromYmdHms(year, month, day, hour, 30, 0);
  const profileLunar = profileSolar.getLunar();
  const profileAstrolabe = astro.bySolar(
    `${year}-${month}-${day}`,
    Math.floor((hour + 1) / 2) % 12,
    gender,
    true,
    'zh-CN',
  );
  return generateLockedZiweiLedger({
    astrolabe: profileAstrolabe,
    caseId: `CASE-${year}-${month}-${day}-${hour}-${gender}`,
    gender,
    birthDate: profileBirthDate,
    reportDate,
    lunarText: profileLunar.toString(),
  });
};

const lunarNewYearBeforeLiChun = makeNatalLedger({ year: 1974, month: 2, day: 4, hour: 0, gender: '男' });
assert.equal(lunarNewYearBeforeLiChun.status, 'PASS', lunarNewYearBeforeLiChun.issues.join('；'));
assert.match(lunarNewYearBeforeLiChun.markdown, /\| M09 \| 生年天干 \| 甲 \|/);
assert.match(lunarNewYearBeforeLiChun.markdown, /\| BS01 \| 禄 \| 廉贞 \| B\d{2} \|/);

const liChunBeforeLunarNewYear = makeNatalLedger({ year: 1985, month: 2, day: 4, hour: 12, gender: '女' });
assert.equal(liChunBeforeLunarNewYear.status, 'PASS', liChunBeforeLunarNewYear.issues.join('；'));
assert.match(liChunBeforeLunarNewYear.markdown, /\| M09 \| 生年天干 \| 甲 \|/);
assert.doesNotMatch(liChunBeforeLunarNewYear.markdown, /\| M09 \| 生年天干 \| 乙 \|/);

const natalProfiles = [
  [1974, 2, 3, 23],
  [1981, 6, 15, 1],
  [1985, 2, 4, 12],
  [1987, 1, 28, 5],
  [1990, 5, 7, 7],
  [1993, 9, 19, 9],
  [1996, 12, 31, 11],
  [1999, 3, 6, 13],
  [2001, 8, 23, 15],
  [2003, 10, 12, 17],
  [2005, 2, 8, 21],
  [2007, 7, 1, 23],
];
let natalMatrixCases = 0;
for (const [year, month, day, hour] of natalProfiles) {
  for (const gender of ['男', '女']) {
    const result = makeNatalLedger({ year, month, day, hour, gender });
    assert.equal(result.status, 'PASS', `${year}-${month}-${day} ${hour}:30 ${gender}: ${result.issues.join('；')}`);
    assertAtomicFacts(result);
    natalMatrixCases += 1;
  }
}

const ignoredDuplicateInputs = makeLedger({
  age: 99,
  reportLunarYear: 1999,
  currentGanZhi: '戊午',
  currentYearBranch: '午',
});
assert.equal(ignoredDuplicateInputs.status, 'PASS');
assert.equal(ignoredDuplicateInputs.fingerprint, valid.fingerprint);
assert.doesNotMatch(ignoredDuplicateInputs.markdown, /农历1999年|虚岁99/);

const originalHoroscope = astrolabe.horoscope.bind(astrolabe);
const yearlyMismatchAstrolabe = Object.create(astrolabe);
yearlyMismatchAstrolabe.horoscope = date => {
  const scope = originalHoroscope(date);
  return {
    ...scope,
    yearly: {
      ...scope.yearly,
      heavenlyStem: scope.yearly.heavenlyStem === '甲' ? '乙' : '甲',
    },
  };
};
const mismatchedYear = makeLedger({ astrolabe: yearlyMismatchAstrolabe });
assert.equal(mismatchedYear.status, 'BLOCKED');
assert.ok(mismatchedYear.issues.some(issue => issue.includes('报告年份干支不一致')));

const decadalMismatchAstrolabe = Object.create(astrolabe);
decadalMismatchAstrolabe.horoscope = date => {
  const scope = originalHoroscope(date);
  return {
    ...scope,
    decadal: {
      ...scope.decadal,
      heavenlyStem: scope.decadal.heavenlyStem === '甲' ? '乙' : '甲',
    },
  };
};
const mismatchedDecadal = makeLedger({ astrolabe: decadalMismatchAstrolabe });
assert.equal(mismatchedDecadal.status, 'BLOCKED');
assert.ok(mismatchedDecadal.issues.some(issue => issue.includes('D02与iztro报告日期所在大限不一致')));
assert.ok(mismatchedDecadal.issues.some(issue => issue.includes('DA大限命宫、干支、四化或代表日期与iztro不一致')));

const dashaTransitionSolar = Lunar.fromYmd(2031, 1, 1).getSolar();
const afterDashaTransition = makeLedger({
  reportDate: new Date(
    dashaTransitionSolar.getYear(),
    dashaTransitionSolar.getMonth() - 1,
    dashaTransitionSolar.getDay(),
    12,
  ),
});
assert.equal(afterDashaTransition.status, 'PASS', afterDashaTransition.issues.join('；'));
assert.match(afterDashaTransition.markdown, /\| DA04 \| 当前 \| 34-43 \| B04 \| 子女宫 \| 壬戌 \|/);
assert.match(afterDashaTransition.markdown, /\| DA05 \| 下一限 \| 44-53 \| B05 \| 财帛宫 \| 辛酉 \|/);
assert.match(afterDashaTransition.markdown, /当前DA事实组与D02摘要一致性 \| DA04\/D02 \| PASS/);

let matrixCases = 0;
for (let year = 2020; year <= 2031; year += 1) {
  const lunarNewYear = Lunar.fromYmd(year, 1, 1).getSolar();
  const dates = [
    new Date(year, 0, 1, 12, 0),
    new Date(lunarNewYear.getYear(), lunarNewYear.getMonth() - 1, lunarNewYear.getDay(), 12, 0),
    new Date(year, 6, 1, 12, 0),
    new Date(year, 11, 31, 12, 0),
  ];

  for (const date of dates) {
    const result = makeLedger({ reportDate: date });
    assert.equal(result.status, 'PASS', `${date.toISOString()}: ${result.issues.join('；')}`);

    const yearly = astrolabe.horoscope(date).yearly;
    const expectedMutagens = Object.values(EXPECTED_SIHUA[yearly.heavenlyStem]);
    assert.deepEqual(yearly.mutagen, expectedMutagens);
    matrixCases += 1;
  }
}

console.log(
  `Ziwei ledger regression passed: ${natalMatrixCases} natal profiles, ${matrixCases} year-boundary cases, and Q6 closure with ${relationshipClosurePass.closureRequired.length} required facts passed.`,
);
