import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditQuestionPage } from './lib/notebook-response-audit.mjs';

const [, , caseDirArg, stepId, ...aliases] = process.argv;
if (!caseDirArg || !stepId || !aliases.length) {
  throw new Error('Usage: node scripts/repair-evidence-alias.mjs <case-dir> <Qn> <wrong-E=declared-E> [...]');
}
for (const alias of aliases) {
  if (!/^E\d+=E\d+$/.test(alias)) throw new Error(`Invalid evidence alias: ${alias}`);
}

const caseDir = path.resolve(caseDirArg);
const responsesDir = path.join(caseDir, 'responses');
const factsPath = path.join(caseDir, 'notebook-facts.md');
const statePath = path.join(caseDir, 'state.json');
let repaired = await readFile(path.join(responsesDir, `${stepId}-answer.txt`), 'utf8');
const evidenceIndex = repaired.search(/^.*证据登记.*$/m);
if (evidenceIndex < 0) throw new Error(`${stepId} has no evidence section.`);
const evidence = repaired.slice(evidenceIndex);

for (const alias of aliases) {
  const [wrongId, declaredId] = alias.split('=');
  if (!new RegExp(`\\b${declaredId}=`).test(evidence)) throw new Error(`${declaredId} is not declared by ${stepId}.`);
  const body = repaired.slice(0, evidenceIndex);
  if (!new RegExp(`\\b${wrongId}\\b`).test(body)) throw new Error(`${wrongId} is not referenced by ${stepId}.`);
  repaired = `${body.replace(new RegExp(`\\b${wrongId}\\b`, 'g'), declaredId)}${evidence}`;
}

const pagePath = path.join(responsesDir, `${stepId}-alias-repaired-page.txt`);
await writeFile(pagePath, `Thoughts\nexpand_more\n${repaired.trim()}\nkeep_pin\n`, 'utf8');
const audited = await auditQuestionPage({ pagePath, factsPath, stepId });
if (audited.result.status !== 'PASS') throw new Error(`${stepId} alias repair remains blocked: ${JSON.stringify(audited.result.issues)}`);

const state = JSON.parse(await readFile(statePath, 'utf8'));
if (!state.notebook.completedQuestions.includes(stepId)) state.notebook.completedQuestions.push(stepId);
state.notebook.inFlight = null;
state.notebook.currentQuestion = stepId;
state.notebook.lastCheckpointAt = new Date().toISOString();
const tempPath = `${statePath}.${process.pid}.tmp`;
await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
await rename(tempPath, statePath);
console.log(JSON.stringify({ stepId, status: audited.result.status, aliases, auditPath: audited.auditPath }, null, 2));
