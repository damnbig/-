import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditQuestionPage } from './lib/notebook-response-audit.mjs';

const [, , caseDirArg, stepId, ...mappings] = process.argv;
if (!caseDirArg || !stepId || !mappings.length) {
  throw new Error('Usage: node scripts/repair-missing-evidence.mjs <case-dir> <Qn> <Eid=FACT> [...]');
}
for (const mapping of mappings) {
  if (!/^E\d+=[A-Z]+\d+(?:-[A-Z]\d*)?$/.test(mapping)) {
    throw new Error(`Invalid evidence mapping: ${mapping}`);
  }
}

const caseDir = path.resolve(caseDirArg);
const responsesDir = path.join(caseDir, 'responses');
const factsPath = path.join(caseDir, 'notebook-facts.md');
const statePath = path.join(caseDir, 'state.json');
const original = await readFile(path.join(responsesDir, `${stepId}-answer.txt`), 'utf8');
const evidenceIndex = original.search(/^.*证据登记.*$/m);
if (evidenceIndex < 0) throw new Error(`${stepId} has no evidence section.`);
for (const mapping of mappings) {
  const evidenceId = mapping.split('=')[0];
  if (new RegExp(`\\b${evidenceId}=`).test(original.slice(evidenceIndex))) {
    throw new Error(`${evidenceId} is already declared in ${stepId}.`);
  }
}

const stopIndex = original.search(/^答完即停止.*$/m);
const insertAt = stopIndex >= 0 ? stopIndex : original.length;
const repaired = `${original.slice(0, insertAt).trimEnd()}\n${mappings.join('\n')}\n${original.slice(insertAt).trimStart()}`.trim();
const repairedPagePath = path.join(responsesDir, `${stepId}-repaired-page.txt`);
await writeFile(repairedPagePath, `Thoughts\nexpand_more\n${repaired}\nkeep_pin\n`, 'utf8');
const audited = await auditQuestionPage({ pagePath: repairedPagePath, factsPath, stepId });
if (audited.result.status !== 'PASS') {
  throw new Error(`${stepId} repair remains blocked: ${JSON.stringify(audited.result.issues)}`);
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
  mappings,
  auditPath: audited.auditPath,
}, null, 2));
