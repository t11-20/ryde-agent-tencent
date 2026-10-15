// Shared execution limits for the workflow.
// - modelAttemptTimeoutMs: budget for one HTTP attempt against the model provider.
// - modelRetries: extra attempts allowed on per-attempt timeouts.
// - networkRetries + retryBackoffMs: extra attempts on network/HTTP transient failures (TypeError, 408/429/5xx),
//   sleeping retryBackoffMs[i] before retry i+1.
// - modelTimeoutMs: caller-side budget for one logical complete() call including retries (2 x 45 s attempts + 5 s slack).
//   The 90 s run deadline still bounds the worst case: a double attempt timeout now hits the deadline rather than this budget.
// - hedgeAfterMs: start a duplicate hedged request when a call is still unsettled after this delay, per call role.
export const EXECUTION_LIMITS = Object.freeze({
  toolRounds: 2, repairAttempts: 2,
  modelTimeoutMs: 95000, modelAttemptTimeoutMs: 45000, modelRetries: 1,
  networkRetries: 2, retryBackoffMs: [300, 1000],
  hedgeAfterMs: {toolRequest: 6000, advocateCase: 20000, judge: 20000},
  runDeadlineMs: 90000
});
