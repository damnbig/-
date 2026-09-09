export const FULL_RUN_ORDER = ['Q0','Q1','Q2','Q3','CP-A-M','Q4','Q5','Q6','CP-B-M','Q7','Q7B','Q8','Q9','CP-C-M','Q10','Q11','Q12','Q12B','CP-D-M'];
export const runOrder = state => FULL_RUN_ORDER.filter(id => !['Q7B','Q12B'].includes(id) || state.notebook.includedOptionalQuestions?.includes(id));
export const nextStep = state => runOrder(state).find(id => !state.notebook.completedQuestions?.includes(id)) ?? null;

export function validateSourceSnapshot(snapshot, state) {
  if (snapshot.url !== state.notebook.url || !snapshot.verifiedAt) throw Error('Unknown source snapshot URL/time');
  const required = state.notebook.sourcePolicy?.courseGroups;
  if (!required?.length) throw Error('Course source policy is missing');
  if (!snapshot.checks?.length || snapshot.checks.some(c => typeof c.checked !== 'boolean' || !c.label)) throw Error('Unknown source selection');
  const selected = snapshot.checks.filter(c => c.checked).map(c => c.label);
  const courses = state.notebook.sourcePolicy?.courseLabels ?? [];
  const facts = selected.filter(l => /^(?:Select |选择“)/.test(l) && !courses.includes(l));
  if (facts.length !== 1 || !facts[0].includes(state.caseId) || !facts[0].includes(state.ledger.fingerprint)) throw Error('Wrong or missing current FACT source');
  if (required.some(group => !selected.includes(group))) throw Error('Required course group is not selected');
  const allowed = new Set([...required, ...courses, ...facts]);
  if (selected.some(l => !allowed.has(l))) throw Error('Unknown selected source/group');
  return snapshot;
}

export function submissionAction(receipt, promptVisible) {
  if (!receipt) return 'SUBMIT';
  if (!receipt.confirmedAt) throw Error('Ambiguous receipt; do not resend');
  if (!promptVisible) throw Error('Confirmed prompt not visible; recover, never resend');
  if (!receipt.sourceSnapshot) throw Error('Sending-time source evidence missing; current selection cannot prove it');
  return 'RECOVER';
}

export function assertRepairAttempt(repairId, files, previousReceipt, deepSemanticReview = true) {
  if (!/^REPAIR-.+-V[1-9]\d*$/.test(repairId)) throw Error('Repair id must have a positive version');
  if (deepSemanticReview && !/-V[12]$/.test(repairId)) throw Error('Deep semantic repair id must end in V1 or V2');
  const family=repairId.replace(/-V\d+$/, '');
  if (deepSemanticReview && !previousReceipt && files.filter(name=>name.startsWith(family+'-V') && name.endsWith('-receipt.json')).length>=2) throw Error('Two local repair attempts exhausted');
}

export function applyAcceptance(state, review, audit, hashes) {
  if (review.stepId !== nextStep(state)) throw Error('Review violates question/CP order');
  if (review.status !== 'PASS' || audit.status !== 'PASS' || !review.rationale?.trim()) throw Error('Both manual and machine PASS with rationale are required');
  if ((audit.question ?? audit.stepId ?? review.stepId) !== review.stepId) throw Error('Audit belongs to another question');
  if (!review.effectiveAnswer || !review.auditPath || !review.version || !review.sourceReceipt) throw Error('Effective version and sending receipt are required');
  const receipt = review.receipt;
  if (!receipt?.confirmedAt || !receipt.sourceSnapshot) throw Error('Unverified sending receipt');
  validateSourceSnapshot(receipt.sourceSnapshot, state);
  const updated = structuredClone(state);
  updated.notebook.reviewHistory ??= [];
  updated.notebook.reviewHistory.push({previousBlock:updated.notebook.manualBlock ?? null, review:{...review,receipt:undefined}, hashes});
  updated.notebook.manualApprovals ??= {};
  updated.notebook.manualApprovals[review.stepId] = {...review, receipt:undefined, hashes};
  updated.notebook.manualBlock = null;
  updated.notebook.completedQuestions = [...(updated.notebook.completedQuestions ?? []),review.stepId];
  updated.notebook.currentQuestion = nextStep(updated);
  if (updated.notebook.inFlight?.stepId === review.stepId) updated.notebook.inFlight = null;
  updated.phase = updated.notebook.currentQuestion ? 'QUESTION_PENDING' : 'COMPLETE';
  if (review.stepId === 'Q0') updated.notebook.admissionPassed = true;
  return updated;
}
