import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  auditQuestionPage,
  normalizeEvidenceBlock,
  repairMappedFactReferences,
} from './lib/notebook-response-audit.mjs';

const [, , caseDirArg, stepId, repairId, mapping] = process.argv;
if (!caseDirArg || !stepId || !repairId || !/^E\d+=[A-Z]+\d+(?:-[A-Z]\d*)?$/.test(mapping ?? '')) {
  throw new Error('Usage: node scripts/merge-closure-repair.mjs <case-dir> <Qn> <repair-id> <Eid=FACT>');
}

const caseDir = path.resolve(caseDirArg);
const responsesDir = path.join(caseDir, 'responses');
const factsPath = path.join(caseDir, 'notebook-facts.md');
const statePath = path.join(caseDir, 'state.json');
const original = await readFile(path.join(responsesDir, `${stepId}-answer.txt`), 'utf8');
const repair = await readFile(path.join(responsesDir, `${repairId}-answer.txt`), 'utf8');

if (!new RegExp(`(?:^|\\n)${mapping.replace('-', '\\-')}(?:\\n|$)`).test(repair)) {
  throw new Error(`${repairId} does not contain the required mapping ${mapping}.`);
}

const evidenceHeadings = [...original.matchAll(/^.*证据登记.*$/gm)];
const evidenceIndex = evidenceHeadings.at(-1)?.index ?? -1;
if (evidenceIndex < 0) throw new Error(`${stepId} has no evidence section.`);

const repairHeading = repair.search(/^补充闭包：\s*$/m);
const repairEvidenceHeading = repair.search(/^补充证据登记：\s*$/m);
if (repairHeading < 0 || repairEvidenceHeading <= repairHeading) {
  throw new Error(`${repairId} does not contain the required closure sections.`);
}
const repairBody = repair.slice(repairHeading, repairEvidenceHeading).trim();

const originalBody = original.slice(0, evidenceIndex).trimEnd();
const originalMappings = original.slice(evidenceIndex).match(/E\d+=[A-Z]+\d+(?:-[A-Z]\d*)?/g) ?? [];
if (originalMappings.some(item => item.startsWith(`${mapping.split('=')[0]}=`))) {
  throw new Error(`${mapping.split('=')[0]} is already declared in ${stepId}.`);
}

const merged = normalizeEvidenceBlock([
  originalBody,
  repairBody,
  '证据登记台账',
  ...originalMappings,
  mapping,
].join('\n'));
const mechanicallyRepaired = repairMappedFactReferences(merged);
const repairedPagePath = path.join(responsesDir, `${stepId}-closure-repaired-page.txt`);
await writeFile(repairedPagePath, `Thoughts\nexpand_more\n${mechanicallyRepaired.answer}\nkeep_pin\n`, 'utf8');
const audited = await auditQuestionPage({ pagePath: repairedPagePath, factsPath, stepId });
audited.result.mergedFrom = [`${stepId}-answer.txt`, `${repairId}-answer.txt`];
audited.result.mergeRepairs = mechanicallyRepaired.repairs;
await writeFile(audited.auditPath, `${JSON.stringify(audited.result, null, 2)}\n`, 'utf8');
if (audited.result.status !== 'PASS') {
  throw new Error(`${stepId} closure repair remains blocked: ${JSON.stringify(audited.result.issues)}`);
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
  mapping,
  mergeRepairs: mechanicallyRepaired.repairs,
  auditPath: audited.auditPath,
}, null, 2));
