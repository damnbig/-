import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditQuestionPage, normalizeEvidenceBlock, repairMappedFactReferences } from './lib/notebook-response-audit.mjs';

const [, , caseDirArg] = process.argv;
if (!caseDirArg) throw new Error('Usage: node scripts/merge-q6-repair.mjs <case-dir>');

const caseDir = path.resolve(caseDirArg);
const responsesDir = path.join(caseDir, 'responses');
const original = await readFile(path.join(responsesDir, 'Q6-answer.txt'), 'utf8');
const repair = await readFile(path.join(responsesDir, 'REPAIR-Q6-answer.txt'), 'utf8');
const factsPath = path.join(caseDir, 'notebook-facts.md');
const requiredMappings = [
  ['E82', 'R03'],
  ['E83', 'F03-Q'],
  ['E84', 'F04-L'],
  ['E85', 'F11-K'],
];

for (const [evidenceId, factId] of requiredMappings) {
  if (!new RegExp(`\\b${evidenceId}=${factId.replace('-', '\\-')}\\b`).test(repair)) {
    throw new Error(`Repair answer is missing ${evidenceId}=${factId}.`);
  }
}

const evidenceHeadings = [...original.matchAll(/^.*证据登记.*$/gm)];
const evidenceHeading = evidenceHeadings.at(-1)?.index ?? -1;
if (evidenceHeading < 0) throw new Error('Original Q6 answer has no evidence heading.');
const roleEnd = repair.search(/^二、.*补充证据登记.*$/m);
if (roleEnd < 0) throw new Error('Repair answer has no supplemental evidence heading.');

const originalBody = original.slice(0, evidenceHeading).trimEnd();
const originalMappings = original.slice(evidenceHeading).match(/E\d+=[A-Z]+\d+(?:-[A-Z]\d*)?/g) ?? [];
const repairRoleBlock = repair.slice(0, roleEnd).trim();
const supplementalMappings = requiredMappings.map(([evidenceId, factId]) => `${evidenceId}=${factId}`);
const merged = [
  originalBody,
  repairRoleBlock,
  '证据登记',
  ...originalMappings,
  ...supplementalMappings,
].join('\n');
const normalized = normalizeEvidenceBlock(merged);
const repaired = repairMappedFactReferences(normalized);
const syntheticPagePath = path.join(responsesDir, 'Q6-repaired-page.txt');
await writeFile(syntheticPagePath, `Thoughts\nexpand_more\n${repaired.answer}\nkeep_pin\n`, 'utf8');
const audited = await auditQuestionPage({ pagePath: syntheticPagePath, factsPath, stepId: 'Q6' });
audited.result.mergedFrom = ['Q6-answer.txt', 'REPAIR-Q6-answer.txt'];
audited.result.mergeRepairs = repaired.repairs;
await writeFile(audited.auditPath, `${JSON.stringify(audited.result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: audited.result.status,
  issues: audited.result.issues,
  mergeRepairs: repaired.repairs,
  auditPath: audited.auditPath,
}, null, 2));
