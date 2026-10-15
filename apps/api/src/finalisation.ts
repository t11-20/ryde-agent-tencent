import type { Escalation, FinalAction, PolicyVerdict, RiskSeverity, RunDivergence } from '@fairtrip/contracts';

export interface FinalisationDecision {
  reasons: Escalation['reasons'];
  divergence?: RunDivergence;
}

// Pure finalisation decision: which escalation reasons apply to a completed run,
// and whether the Judge's remedy diverges from the deterministic policy verdict.
// 'incomplete' verdicts are handled by the decisive-evidence guard upstream.
export function finalisationDecision(
  verdict: PolicyVerdict | undefined,
  remedyId: FinalAction['remedyId'],
  confidence: number,
  threshold: number,
  riskOverall: RiskSeverity | undefined
): FinalisationDecision {
  const reasons: Escalation['reasons'] = [];
  if (confidence < threshold) reasons.push('low_confidence');
  if (riskOverall === 'high') reasons.push('high_risk');
  let divergence: RunDivergence | undefined;
  if (verdict !== undefined) {
    if (verdict.outcome === 'undetermined') reasons.push('policy_undetermined');
    else if (verdict.outcome !== 'incomplete' && verdict.outcome !== remedyId) {
      reasons.push('policy_divergence');
      divergence = {
        judgeRemedyId: remedyId,
        verdictOutcome: verdict.outcome,
        summary: `Policy rules give ${verdict.outcome} under ${verdict.clauseIds.join(', ')}; the Judge chose ${remedyId} at confidence ${confidence}. Nothing is paid until a reviewer decides.`,
      };
    }
  }
  return divergence === undefined ? {reasons} : {reasons, divergence};
}

const PROVIDER_FAILURE_PATTERNS = ['aborted due to timeout', 'TimeoutError', 'fetch failed', 'network', 'Run deadline exceeded'];

// Provider-side failures (endpoint latency, connectivity, the run deadline) —
// the eval scorecard still classifies failure causes with this, separately
// from the retry decision.
export function isProviderFailure(message: string): boolean {
  return PROVIDER_FAILURE_PATTERNS.some(pattern => message.includes(pattern));
}

// Any first-attempt workflow failure justifies exactly one automatic re-run
// except an internal invariant violation, which a second attempt would only
// repeat. (REPLAY_INVALID is recorded for completeness; replays never reach here.)
export function isRetryableFailure(message: string): boolean {
  // A model 4xx other than the retryable 408/429 is a request-shape problem a
  // second identical attempt cannot fix, so it does not trigger a re-run.
  const http = /Model request failed \(HTTP (\d{3})\)/.exec(message)?.[1];
  if (http !== undefined && http.startsWith('4') && http !== '408' && http !== '429') return false;
  return !message.startsWith('VERDICT_INVARIANT') && !message.includes('REPLAY_INVALID');
}
