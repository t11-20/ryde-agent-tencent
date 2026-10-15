import { describe, expect, it } from 'vitest';
import type { PolicyVerdict } from '@fairtrip/contracts';
import { finalisationDecision, isProviderFailure, isRetryableFailure } from '../apps/api/src/finalisation.js';

const verdict = (outcome: PolicyVerdict['outcome']): PolicyVerdict => ({
  outcome, clauseIds: ['RD-1', 'RD-4'], basis: 'basis', features: [], missingFamilies: [],
});

describe('finalisationDecision', () => {
  it('produces no reasons when the remedy matches the verdict and nothing else applies', () => {
    expect(finalisationDecision(verdict('keep_charge'), 'keep_charge', 0.9, 0.8, 'medium')).toEqual({reasons: []});
  });

  it('escalates with policy_divergence and a divergence record when the remedy differs', () => {
    const decision = finalisationDecision(verdict('keep_charge'), 'refund_route_excess', 0.78, 0.8, 'low');
    expect(decision.reasons).toContain('policy_divergence');
    expect(decision.divergence).toMatchObject({judgeRemedyId: 'refund_route_excess', verdictOutcome: 'keep_charge'});
    expect(decision.divergence?.summary).toContain('keep_charge');
    expect(decision.divergence?.summary).toContain('Nothing is paid until a reviewer decides.');
  });

  it('escalates with policy_undetermined when the verdict is undetermined, whatever the remedy', () => {
    expect(finalisationDecision(verdict('undetermined'), 'keep_charge', 0.9, 0.8, 'low').reasons).toEqual(['policy_undetermined']);
    expect(finalisationDecision(verdict('undetermined'), 'refund_route_excess', 0.9, 0.8, 'low').divergence).toBeUndefined();
  });

  it('produces no policy reasons for an incomplete verdict or a missing verdict', () => {
    expect(finalisationDecision(verdict('incomplete'), 'keep_charge', 0.9, 0.8, 'low')).toEqual({reasons: []});
    expect(finalisationDecision(undefined, 'keep_charge', 0.9, 0.8, 'low')).toEqual({reasons: []});
  });

  it('keeps low_confidence and high_risk alongside policy reasons', () => {
    const decision = finalisationDecision(verdict('keep_charge'), 'refund_no_show_fee', 0.5, 0.8, 'high');
    expect(decision.reasons).toEqual(['low_confidence', 'high_risk', 'policy_divergence']);
  });
});

describe('isProviderFailure', () => {
  it('classifies timeout, network and deadline messages as provider failures', () => {
    for (const message of ['The operation was aborted due to timeout', 'TimeoutError', 'fetch failed', 'network unreachable', 'Run deadline exceeded (90s)'])
      expect(isProviderFailure(message)).toBe(true);
  });

  it('does not classify model-output failures', () => {
    for (const message of ['unparseable output after repairs', 'Unknown policy citation: GE-1', 'Advocate returned the wrong side'])
      expect(isProviderFailure(message)).toBe(false);
  });
});

describe('isRetryableFailure', () => {
  it('treats every ordinary workflow failure — including model-output failures — as retryable', () => {
    for (const message of [
      'The operation was aborted due to timeout',
      'Run deadline exceeded (90s)',
      'unparseable output after repairs',
      'Judge output failed schema or citation validation after 2 repair attempts (invalid JSON).',
      'Unknown evidence citation: EV-FAKE',
      'Advocate returned the wrong side',
      'Remedy validation failed'
    ]) expect(isRetryableFailure(message)).toBe(true);
  });

  it('never retries an internal invariant violation', () => {
    expect(isRetryableFailure('VERDICT_INVARIANT: unescalated ruling keep_charge diverges from the policy verdict refund_route_excess')).toBe(false);
    expect(isRetryableFailure('REPLAY_INVALID: Recorded amount 99999 differs from server-computed 198')).toBe(false);
  });

  it('never retries a model HTTP 4xx the call-level policy already declined (except 408/429)', () => {
    for (const status of ['400', '401', '403', '404', '422'])
      expect(isRetryableFailure(`Model request failed (HTTP ${status}): 'type' must be in ["enabled"]`)).toBe(false);
    expect(isRetryableFailure('Model request failed (HTTP 408): request timeout')).toBe(true);
    expect(isRetryableFailure('Model request failed (HTTP 429): rate limited')).toBe(true);
    expect(isRetryableFailure('Model request failed (HTTP 500): internal')).toBe(true);
    expect(isRetryableFailure('Model request failed (HTTP 503): upstream unavailable')).toBe(true);
  });
});
