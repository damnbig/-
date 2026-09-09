import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditQuestionPage } from './lib/notebook-response-audit.mjs';

const [, , caseDirArg, stepId, repairId, ...factMappings] = process.argv;
if (!caseDirArg || !stepId || !repairId) {
  throw new Error('Usage: node scripts/merge-course-role-repair.mjs <case-dir> <Qn> <repair-id> [Eid=FACT ...]');
}

const caseDir = path.resolve(caseDirArg);
const responsesDir = path.join(caseDir, 'responses');
const factsPath = path.join(caseDir, 'notebook-facts.md');
const statePath = path.join(caseDir, 'state.json');
const original = await readFile(path.join(responsesDir, `${stepId}-answer.txt`), 'utf8');
const repair = await readFile(path.join(responsesDir, `${repairId}-answer.txt`), 'utf8');

let repairMatches = [...repair.matchAll(/(?:^|\n)\d+\.\s+(E\d+)\s*\n([\s\S]*?)(?=\n\d+\.\s+E\d+\s*\n|\nREPAIR-|$)/g)];
if (!repairMatches.length) {
  repairMatches = [...repair.matchAll(/(?:^|\n)(E\d+)\s+([\s\S]*?)(?=\nE\d+\s+|\nREPAIR-|$)/g)];
}
const repairItems = repairMatches.map(match => {
  const status = match[2].match(/直接支持状态：\s*(SUPPORTED|PENDING_SOURCE)/)?.[1];
  const theme = match[2].match(/原句主题：\s*([^\n]+)/)?.[1]?.trim();
  if (!status || !theme) throw new Error(`Could not parse course review for ${match[1]}.`);
  return { evidenceId: match[1], status, theme };
});
if (!repairItems.length) throw new Error(`No course review items found in ${repairId}.`);

const factBindingIds = new Set();
for (const mapping of factMappings) {
  if (!/^E\d+=[A-Z]+\d+(?:-[A-Z]\d*)?$/.test(mapping)) throw new Error(`Invalid FACT mapping: ${mapping}`);
  factBindingIds.add(mapping.split('=')[0]);
}

const evidenceHeading = original.search(/^.*证据登记与事实映射台账.*$/m);
if (evidenceHeading < 0) throw new Error(`${stepId} has no evidence mapping heading.`);
let body = original.slice(0, evidenceHeading).trimEnd();
let evidence = original.slice(evidenceHeading);

for (const item of repairItems) {
  if (factBindingIds.has(item.evidenceId)) continue;
  const token = new RegExp(`(?<![A-Z0-9])${item.evidenceId}(?![A-Z0-9])`, 'g');
  body = body.replace(token, '');
}
const currentQuestionNumber = stepId.match(/^Q(\d+)$/)?.[1];
body = body.replace(/\bC(\d+)-(\d+)\b/g, (match, question, item) => (
  question === currentQuestionNumber ? match : `问题${question}第${item}项`
));
body = body.replace(/（\s*）|\(\s*\)/g, '').replace(/[ \t]+\n/g, '\n');

for (const mapping of factMappings) {
  const evidenceId = mapping.split('=')[0];
  if (new RegExp(`\\b${evidenceId}=`).test(evidence)) throw new Error(`${evidenceId} is already declared.`);
}
const stopIndex = evidence.search(/^答完即停止.*$/m);
const insertAt = stopIndex >= 0 ? stopIndex : evidence.length;
evidence = `${evidence.slice(0, insertAt).trimEnd()}\n${factMappings.join('\n')}\n${evidence.slice(insertAt).trimStart()}`;

const reviewLines = repairItems
  .filter(item => !factBindingIds.has(item.evidenceId))
  .map((item, index) => {
    const label = item.evidenceId.slice(1);
    const verdict = item.status === 'SUPPORTED'
      ? '课程直接支持，原判断保留。'
      : '课程暂未直接闭合，原判断保留为待核推论，不单独作为定论。';
    return `${index + 1}. 课程项${label}：${item.theme}。${verdict}`;
  });
const appendix = [
  '课程引用角色复核（不占用盘面证据编号）',
  ...reviewLines,
].join('\n');

const repaired = `${body}\n\n${appendix}\n\n${evidence}`.trim();
const repairedPagePath = path.join(responsesDir, `${stepId}-course-repaired-page.txt`);
await writeFile(repairedPagePath, `Thoughts\nexpand_more\n${repaired}\nkeep_pin\n`, 'utf8');
const audited = await auditQuestionPage({ pagePath: repairedPagePath, factsPath, stepId });
if (audited.result.status !== 'PASS') {
  throw new Error(`${stepId} course-role repair remains blocked: ${JSON.stringify(audited.result.issues)}`);
}

const state = JSON.parse(await readFile(statePath, 'utf8'));
if (!state.notebook.completedQuestions.includes(stepId)) state.notebook.completedQuestions.push(stepId);
state.notebook.inFlight = null;
state.notebook.currentQuestion = stepId;
state.notebook.lastCheckpointAt = new Date().toISOString();
const tempPath = `${statePath}.${process.pid}.tmp`;
await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
await rename(tempPath, statePath);

console.log(JSON.stringify({
  stepId,
  status: audited.result.status,
  reviewedCourseItems: repairItems.length,
  pendingCourseItems: repairItems.filter(item => item.status === 'PENDING_SOURCE').map(item => item.evidenceId),
  factMappings,
  auditPath: audited.auditPath,
}, null, 2));
