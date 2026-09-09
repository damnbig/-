export const assertWorkflowAllowed = state => {
  if (state.notebook?.manualBlock?.status === 'BLOCKED') {
    throw new Error(`Manual review blocks ${state.notebook.manualBlock.stepId}; machine PASS cannot override it.`);
  }
};

export const canAdvanceAfterAudit = (state, stepId, audit) => {
  assertWorkflowAllowed(state);
  if (audit.status !== 'PASS') return false;
  return !state.notebook?.manualReviewRequired
    || state.notebook.manualApprovals?.[stepId]?.status === 'PASS';
};
