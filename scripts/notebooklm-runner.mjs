import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , command = 'status', caseDirArg, ...args] = process.argv;

if (!caseDirArg) {
  throw new Error('Usage: node scripts/notebooklm-runner.mjs <status|next|advance|include-optionals> <case-dir> [step-id]');
}

const caseDir = path.resolve(caseDirArg);
const statePath = path.join(caseDir, 'state.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
const flowPath = path.resolve('tmp/automation-poc/question-flow-v0.11.json');
const flow = JSON.parse(await readFile(flowPath, 'utf8'));
const fullRunOrder = [
  'Q0', 'Q1', 'Q2', 'Q3', 'CP-A-M',
  'Q4', 'Q5', 'Q6', 'CP-B-M',
  'Q7', 'Q7B', 'Q8', 'Q9', 'CP-C-M',
  'Q10', 'Q11', 'Q12', 'Q12B', 'CP-D-M',
];
const optionalIds = new Set(['Q7B', 'Q12B']);
const getRunOrder = currentState => {
  const included = new Set(currentState.notebook.includedOptionalQuestions ?? []);
  return fullRunOrder.filter(id => !optionalIds.has(id) || included.has(id));
};

if (command === 'include-optionals') {
  if (state.notebook.inFlight) throw new Error('Cannot change optional questions while a step is in flight.');
  const requested = args.length ? args : ['Q7B', 'Q12B'];
  const invalid = requested.filter(id => !optionalIds.has(id));
  if (invalid.length) throw new Error(`Unknown optional question(s): ${invalid.join(', ')}`);
  const included = new Set(state.notebook.includedOptionalQuestions ?? []);
  requested.forEach(id => included.add(id));
  state.notebook.includedOptionalQuestions = fullRunOrder.filter(id => included.has(id));
  const completed = new Set(state.notebook.completedQuestions ?? []);
  if (requested.includes('Q7B')) {
    completed.delete('CP-C-M');
    completed.delete('CP-D-M');
  }
  if (requested.includes('Q12B')) completed.delete('CP-D-M');
  const runOrder = getRunOrder(state);
  state.notebook.completedQuestions = runOrder.filter(id => completed.has(id));
  state.notebook.currentQuestion = runOrder.find(id => !completed.has(id)) ?? null;
  state.phase = state.notebook.currentQuestion
    ? (state.notebook.currentQuestion.startsWith('CP-') ? 'CHECKPOINT_PENDING' : 'QUESTION_PENDING')
    : 'COMPLETE';
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    includedOptionalQuestions: state.notebook.includedOptionalQuestions,
    invalidatedCheckpoints: requested.includes('Q7B') ? ['CP-C-M', 'CP-D-M'] : ['CP-D-M'],
    next: state.notebook.currentQuestion,
    phase: state.phase,
  }, null, 2));
  process.exit(0);
}

const runOrder = getRunOrder(state);
const completed = new Set(state.notebook.completedQuestions ?? []);
const nextId = runOrder.find(id => !completed.has(id)) ?? null;

if (command === 'status') {
  console.log(JSON.stringify({
    caseId: state.caseId,
    phase: state.phase,
    completed: [...completed],
    next: nextId,
    notebookUrl: state.notebook.url,
    promptVersion: state.notebook.promptVersion,
  }, null, 2));
  process.exit(0);
}

if (command === 'next') {
  if (!nextId) {
    console.log(JSON.stringify({ done: true, caseId: state.caseId }, null, 2));
    process.exit(0);
  }
  const item = flow.items.find(candidate => candidate.id === nextId);
  if (!item) throw new Error(`Prompt ${nextId} is missing from ${flowPath}`);
  console.log(JSON.stringify({
    done: false,
    id: item.id,
    title: item.title,
    prompt: item.prompt,
    kind: item.id.startsWith('CP-') ? 'checkpoint' : 'question',
    notebookUrl: state.notebook.url,
  }, null, 2));
  process.exit(0);
}

if (command === 'advance') {
  if (state.notebook.manualReviewRequired || state.notebook.manualBlock?.status === 'BLOCKED') throw Error('Use notebooklm-accept with a versioned manual review; legacy advance is disabled.');
  const [stepId, resultPathArg] = args;
  if (!stepId || !resultPathArg) {
    throw new Error('advance requires <step-id> <audit-json-or-checkpoint-json>');
  }
  if (stepId !== nextId) {
    throw new Error(`Refusing out-of-order advance: expected ${nextId}, received ${stepId}`);
  }
  const resultPath = path.resolve(resultPathArg);
  const result = JSON.parse(await readFile(resultPath, 'utf8'));
  if (result.status !== 'PASS') {
    console.log(JSON.stringify({ advanced: false, stepId, status: result.status, issues: result.issues ?? [] }, null, 2));
    process.exitCode = 2;
    process.exit();
  }

  completed.add(stepId);
  const following = runOrder.find(id => !completed.has(id)) ?? null;
  state.notebook.completedQuestions = runOrder.filter(id => completed.has(id));
  state.notebook.currentQuestion = following;
  state.notebook.inFlight = null;
  state.notebook.lastCheckpointAt = new Date().toISOString();
  state.phase = following ? (following.startsWith('CP-') ? 'CHECKPOINT_PENDING' : 'QUESTION_PENDING') : 'COMPLETE';
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ advanced: true, completed: stepId, next: following, phase: state.phase }, null, 2));
  process.exit(0);
}

throw new Error(`Unknown command: ${command}`);
