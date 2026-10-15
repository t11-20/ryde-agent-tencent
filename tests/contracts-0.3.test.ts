import { describe, it, expect } from 'vitest';
import {
  ActivityEventSchema, RISK_CAVEAT, ReviewRequestSchema, RunSchema,
} from '@fairtrip/contracts';
import { catalog, examplesFor } from '../apps/api/src/catalog.js';

const dispute = catalog.disputes[0]!;
const {cases, modelResponse, policies} = examplesFor(dispute);
const action = {remedyId: modelResponse.remedyId, recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Test action'} as const;
const result = {...modelResponse, action};
const baseRun = {
  id: 'run-example', fixtureId: dispute.id, mode: 'stub', status: 'completed', dispute, cases,
  events: [catalog.event], retrievedEvidence: [], retrievedPolicies: [], result,
};

const risk = {
  overall: 'medium',
  signals: [{
    code: 'low_rating', party: 'driver', severity: 'medium',
    detail: 'Driver rating is 4.0, below the review threshold.', evidenceIds: ['e-hist'],
  }],
  summary: 'One driver signal.',
  caveat: RISK_CAVEAT,
  source: 'deterministic',
};

const precedent = {
  id: 'PREC-TEST', category: dispute.category, decidedAt: '2026-09-01T00:00:00.000Z',
  origin: 'seed', ruling: 'driver_favored', remedyId: 'keep_charge',
  features: ['rd1_exceeded'], summary: 'Synthetic precedent: a prior ruling for tests.',
};

const escalation = {
  reasons: ['low_confidence'], confidence: 0.5, threshold: 0.7,
  summary: 'Confidence below the review threshold.',
};

const review = {
  decision: 'confirmed', decidedAt: '2026-09-02T00:00:00.000Z', note: 'Checked.',
  ruling: 'rider_favored', action,
};

describe('contract 0.3.2 additions', () => {
  const verdict = {
    outcome: 'keep_charge', clauseIds: ['RD-1', 'RD-4'],
    basis: 'A documented reroute explains the departure.', features: ['documented_reroute'], missingFamilies: [],
  };
  const divergence = {
    judgeRemedyId: 'refund_route_excess', verdictOutcome: 'keep_charge',
    summary: 'Policy rules give keep_charge; the Judge chose otherwise.',
  };

  it('accepts a run with verdict, divergence and retry linkage', () => {
    const escalated = {...escalation, reasons: ['policy_divergence']};
    expect(RunSchema.safeParse({...baseRun, verdict, divergence, escalation: escalated}).success).toBe(true);
    expect(RunSchema.safeParse({...baseRun, verdict, retryOf: 'run-1'}).success).toBe(true);
    const {result: _result, ...rest} = baseRun;
    expect(RunSchema.safeParse({...rest, status: 'failed', error: {code: 'WORKFLOW_FAILED', message: 'boom'}, retriedBy: 'run-2'}).success).toBe(true);
  });

  it('accepts the new escalation reasons and rejects unknown ones', () => {
    expect(RunSchema.safeParse({...baseRun, escalation: {...escalation, reasons: ['policy_divergence', 'policy_undetermined']}}).success).toBe(true);
    expect(RunSchema.safeParse({...baseRun, escalation: {...escalation, reasons: ['made_up_reason']}}).success).toBe(false);
  });

  it('accepts verdict.computed and run.retrying as system events', () => {
    for (const type of ['verdict.computed', 'run.retrying']) {
      expect(ActivityEventSchema.safeParse({...catalog.event, actor: 'system', type}).success).toBe(true);
    }
  });

  it('rejects a verdict with a bad outcome', () => {
    expect(RunSchema.safeParse({...baseRun, verdict: {...verdict, outcome: 'maybe'}}).success).toBe(false);
  });
});

describe('contract 0.3.1 additions', () => {
  it('accepts mode replay and the optional replay block', () => {
    const replay = {sourceRunId: 'run-source-1', recordedAt: '2026-10-13T14:44:17.073Z', sourceEvalRun: '20261013-144417', speed: 1};
    const replayEvent = {...catalog.event, mode: 'replay'};
    expect(RunSchema.safeParse({...baseRun, mode: 'replay', events: [replayEvent], replay}).success).toBe(true);
    expect(RunSchema.safeParse({...baseRun, replay}).success).toBe(true);
  });

  it('rejects a replay block with a nonpositive speed or missing fields', () => {
    expect(RunSchema.safeParse({...baseRun, replay: {sourceRunId: 'r', recordedAt: '2026-10-13T14:44:17.073Z', sourceEvalRun: 'x', speed: 0}}).success).toBe(false);
    expect(RunSchema.safeParse({...baseRun, replay: {sourceRunId: 'r'}}).success).toBe(false);
  });
});

describe('contract 0.3.0 additions', () => {
  it('parses a completed run with risk, precedents, escalation and a confirmed review', () => {
    expect(RunSchema.safeParse({...baseRun, risk, precedents: [precedent], escalation, review}).success).toBe(true);
  });

  it('rejects a review without an escalation', () => {
    const parsed = RunSchema.safeParse({...baseRun, review});
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.some(i => i.message === 'A review requires an escalated run')).toBe(true);
  });

  it('rejects a confirmed review whose remedy differs from the Judge action', () => {
    const otherRemedy = modelResponse.remedyId === 'keep_charge' ? 'refund_route_excess' : 'keep_charge';
    const badAction = {remedyId: otherRemedy, recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Test action'};
    const parsed = RunSchema.safeParse({...baseRun, escalation, review: {...review, action: badAction}});
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.some(i => i.message === 'A confirmed review must keep the Judge remedy')).toBe(true);
  });

  it('rejects an overridden ReviewRequest without a remedyId', () => {
    expect(ReviewRequestSchema.safeParse({decision: 'overridden'}).success).toBe(false);
    expect(ReviewRequestSchema.safeParse({decision: 'overridden', remedyId: 'keep_charge'}).success).toBe(true);
    expect(ReviewRequestSchema.safeParse({decision: 'confirmed'}).success).toBe(true);
  });

  it('accepts a completed run with none of the new fields', () => {
    expect(RunSchema.safeParse(baseRun).success).toBe(true);
  });

  it('accepts the new actors and event types', () => {
    for (const [actor, type] of [['risk', 'risk.assessed'], ['precedent', 'precedent.retrieved'], ['system', 'run.escalated'], ['judge', 'review.decided']]) {
      expect(ActivityEventSchema.safeParse({...catalog.event, actor, type}).success).toBe(true);
    }
  });
});
