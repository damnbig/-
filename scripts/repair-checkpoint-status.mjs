import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditCheckpointPage } from './lib/notebook-response-audit.mjs';

const [, , caseDirArg, stepId, ...statusLines] = process.argv;
if (!caseDirArg || !stepId || !statusLines.length) {
  throw new Error('Usage: node scripts/repair-checkpoint-status.mjs <case-dir> <CP-id> <status-line> [...]');
}

const caseDir = path.resolve(caseDirArg);
const responsesDir = path.join(caseDir, 'responses');
const statePath = path.join(caseDir, 'state.json');
const original = await readFile(path.join(responsesDir, `${stepId}-answer.txt`), 'utf8');
const insertIndex = original.search(/^证据登记与事实映射台账/m);
const insertAt = insertIndex >= 0 ? insertIndex : original.length;
const repaired = `${original.slice(0, insertAt).trimEnd()}\n\n${statusLines.join('\n')}\n\n${original.slice(insertAt).trimStart()}`.trim();
const pagePath = path.join(responsesDir, `${stepId}-repaired-page.txt`);
await writeFile(pagePath, `Thoughts\nexpand_more\n${repaired}\nkeep_pin\n`, 'utf8');
const audited = await auditCheckpointPage({ pagePath, stepId });
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
console.log(JSON.stringify({ stepId, status: audited.result.status, statusLines, auditPath: audited.auditPath }, null, 2));
