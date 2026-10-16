import { describe, expect, it } from 'vitest';
import { RunSchema } from '@fairtrip/contracts';
import type { Run } from '@fairtrip/contracts';
import { completedRun, incompleteRun } from '../lib/test-runs.js';
import { reviewActions } from './review-actions.js';

type CompletedRun = Extract<Run, {status: 'completed'}>;

function completed(): CompletedRun {
  const run = completedRun();
  if (run.status !== 'completed') throw new Error('Expected a completed test run');
  return run;
}

function escalated(extra: Record<string, unknown> = {}): CompletedRun {
  const run = completed();
  const parsed = RunSchema.parse({...run, escalation: {
    reasons: ['low_confidence'], confidence: run.result.confidence,
    threshold: 0.8, summary: 'The Judge recommendation requires human review.',
  }, ...extra});
  if (parsed.status !== 'completed') throw new Error('Expected a completed test run');
  return parsed;
}

function divergent(): CompletedRun {
  return escalated({
    escalation: {
      reasons: ['policy_divergence'], confidence: 0.86, threshold: 0.8,
      summary: 'The Judge ruling differs from the deterministic policy verdict.',
    },
    verdict: {outcome: 'keep_charge', clauseIds: ['RD-3'], basis: 'Detour within the free-detour allowance', features: [], missingFamilies: []},
    divergence: {judgeRemedyId: 'refund_route_excess', verdictOutcome: 'keep_charge', summary: 'The Judge chose a different remedy than the policy rules.'},
  });
}

describe('glass reviewActions', () => {
  it('offers every action, including the policy verdict, on a pending divergent run', () => {
    expect(reviewActions(divergent())).toEqual({confirm: true, override: true, applyVerdictId: 'keep_charge'});
  });

  it('offers confirm and override without a policy shortcut when the verdict agrees', () => {
    const run = escalated({verdict: {
      outcome: 'refund_route_excess', clauseIds: ['RD-2'], basis: 'Material detour', features: [], missingFamilies: [],
    }});
    expect(reviewActions(run)).toEqual({confirm: true, override: true, applyVerdictId: null});
  });

  it('offers nothing once a human reviewer has decided', () => {
    const pending = divergent();
    const parsed = RunSchema.parse({...pending, review: {
      decision: 'confirmed', decidedAt: pending.events.at(-1)?.timestamp,
      note: '', ruling: pending.result.ruling, action: pending.result.action,
    }});
    expect(reviewActions(parsed)).toEqual({confirm: false, override: false, applyVerdictId: null});
  });

  it('offers nothing for an ordinary completed run, an incomplete run, or no run', () => {
    expect(reviewActions(completed())).toEqual({confirm: false, override: false, applyVerdictId: null});
    expect(reviewActions(incompleteRun())).toEqual({confirm: false, override: false, applyVerdictId: null});
    expect(reviewActions(null)).toEqual({confirm: false, override: false, applyVerdictId: null});
  });
});
