import { describe, expect, it } from 'vitest';
import { RISK_CAVEAT } from '@fairtrip/contracts';
import type { ActivityEvent, Escalation, PolicyVerdict, RiskAssessment, Run, RunDivergence } from '@fairtrip/contracts';
import { completedRun, event, sampleEvents } from './test-runs.js';
import { elapsedSeconds } from './events.js';
import {
  actionHeadline, actorDisplay, categoryLabel, clauseLabel, describeError, divergenceComparison,
  escalationLines, eventDisplay, evidenceLabel, firstSentence, formatCount, formatSeconds,
  hearingGeometry, pageState, partitionClauses, paymentGauge, pickupGauge, plural,
  policyVerdictRemedy, precedentOriginLabel, remedyOptions, retryNote, reviewHeadline,
  reviewState, riskLevelLabel, routeGauge, sgtTime, signalLabel, stageOf, stoppedAfterSeconds,
  verdictAgreement, verdictLine, verdictOutcomeLabel,
} from './present.js';
import type { Facts } from './present.js';

function card(kind: string, facts: Facts, timestamp = '2026-10-02T03:12:00Z', id = 'EV-1') {
  return {id, kind, timestamp, facts};
}

describe('formatCount', () => {
  it('groups thousands', () => { expect(formatCount(2642)).toBe('2,642'); });
});

describe('plural', () => {
  it('uses the singular at one and plural otherwise', () => {
    expect(plural(1, 'record', 'records')).toBe('1 record');
    expect(plural(10, 'record', 'records')).toBe('10 records');
  });
});

describe('categoryLabel', () => {
  it('maps known categories and passes others through', () => {
    expect(categoryLabel('route_deviation')).toBe('Route deviation');
    expect(categoryLabel('no_show')).toBe('No-show');
    expect(categoryLabel('other')).toBe('other');
  });
});

describe('sgtTime', () => {
  it('formats 24-hour Asia/Singapore time', () => {
    expect(sgtTime('2026-10-02T03:12:00Z')).toBe('11:12');
  });
});

describe('evidenceLabel', () => {
  it('labels each record kind', () => {
    expect(evidenceLabel(card('route_metrics', {kind: 'route_metrics'}))).toBe('Route vs reference');
    expect(evidenceLabel(card('nav_event', {kind: 'nav_event'}))).toBe('Navigation reroute');
    expect(evidenceLabel(card('traffic_advisory', {kind: 'traffic_advisory'}))).toBe('Traffic advisory');
    expect(evidenceLabel(card('pickup_metrics', {kind: 'pickup_metrics'}))).toBe('Pickup arrival and wait');
    expect(evidenceLabel(card('chat_summary', {kind: 'chat_summary'}))).toBe('Chat summary');
    expect(evidenceLabel(card('fare_breakdown', {kind: 'fare_breakdown'}))).toBe('Fare breakdown');
    expect(evidenceLabel(card('remedy_basis', {kind: 'remedy_basis'}))).toBe('Refund calculation');
  });
  it('labels chat messages by sender and Singapore time', () => {
    expect(evidenceLabel(card('chat_message', {kind: 'chat_message', sender: 'rider'}))).toBe('Rider message 11:12');
    expect(evidenceLabel(card('chat_message', {kind: 'chat_message', sender: 'driver'}))).toBe('Driver message 11:12');
  });
  it('labels calls by caller and Singapore time', () => {
    expect(evidenceLabel(card('call_log', {kind: 'call_log', from: 'driver'}, '2026-10-02T01:08:00Z'))).toBe('Driver call 09:08');
    expect(evidenceLabel(card('call_log', {kind: 'call_log', from: 'rider'}, '2026-10-02T01:08:00Z'))).toBe('Rider call 09:08');
  });
  it('labels history by party', () => {
    expect(evidenceLabel(card('party_history', {kind: 'party_history', party: 'rider'}))).toBe('Rider history');
    expect(evidenceLabel(card('party_history', {kind: 'party_history', party: 'driver'}))).toBe('Driver history');
  });
  it('falls back to the record id for unknown kinds or missing fields', () => {
    expect(evidenceLabel(card('something_else', {kind: 'something_else'}, '2026-10-02T03:12:00Z', 'EV-9'))).toBe('EV-9');
    expect(evidenceLabel(card('chat_message', {kind: 'chat_message'}))).toBe('EV-1');
    expect(evidenceLabel(card('party_history', {kind: 'party_history'}))).toBe('EV-1');
  });
});

describe('clauseLabel', () => {
  it('labels known clauses and passes unknown through', () => {
    expect(clauseLabel('RD-1')).toBe('Material detour test');
    expect(clauseLabel('RD-7')).toBe('History is context only');
    expect(clauseLabel('NS-1')).toBe('No-show fee conditions');
    expect(clauseLabel('NS-4')).toBe('History is context only');
    expect(clauseLabel('ZZ-9')).toBe('ZZ-9');
  });
});

describe('firstSentence', () => {
  it('stops after the first terminator followed by whitespace', () => {
    expect(firstSentence('Refund S$1.98 is due. More text.')).toBe('Refund S$1.98 is due.');
  });
  it('returns the whole text when there is no terminator', () => {
    expect(firstSentence('No ruling issued')).toBe('No ruling issued');
  });
  it('returns a single sentence ending at the string end', () => {
    expect(firstSentence('The driver waited.')).toBe('The driver waited.');
  });
});

describe('actionHeadline', () => {
  it('describes the server action for a completed run', () => {
    const run = completedRun();
    if (run.status !== 'completed') throw new Error('expected completed run');
    expect(actionHeadline(run.result.action)).toBe('Refund S$1.98 to the rider');
  });
  it('describes keeping the charge', () => {
    expect(actionHeadline({recipient: 'none', amountCents: 0})).toBe('Keep the charge: S$0.00 refunded');
  });
});

describe('stageOf', () => {
  it('advances through the run stages', () => {
    expect(stageOf([])).toBe(0);
    const started = sampleEvents[0];
    if (started === undefined) throw new Error('missing event');
    expect(stageOf([started])).toBe(0);
    expect(stageOf(sampleEvents.slice(0, 3))).toBe(1);
    expect(stageOf(sampleEvents.slice(0, 6))).toBe(1);
    expect(stageOf(sampleEvents.slice(0, 7))).toBe(2);
    expect(stageOf(sampleEvents.slice(0, 8))).toBe(3);
    expect(stageOf(sampleEvents)).toBe(4);
  });
});

describe('partitionClauses', () => {
  it('puts cited clauses first in policy order', () => {
    const run = completedRun();
    const {cited, rest} = partitionClauses(run.retrievedPolicies, ['RD-2']);
    expect(cited.map(c => c.id)).toEqual(['RD-2']);
    expect(rest).toHaveLength(0);
    const none = partitionClauses(run.retrievedPolicies, []);
    expect(none.cited).toHaveLength(0);
    expect(none.rest.map(c => c.id)).toEqual(['RD-2']);
  });
});

describe('describeError', () => {
  it('maps an overload failure', () => {
    const d = describeError('WORKFLOW_FAILED', 'Model request failed (HTTP 529): overloaded_error');
    expect(d.title).toBe('The AI model is overloaded');
    expect(d.retry).toBe(true);
  });
  it('maps a rate limit', () => {
    const d = describeError('X', 'HTTP 429 too many requests');
    expect(d.title).toBe("The model's rate limit was reached");
    expect(d.retry).toBe(true);
  });
  it('maps a rejected key with no retry', () => {
    expect(describeError('X', 'HTTP 401 unauthorized').retry).toBe(false);
    expect(describeError('X', 'HTTP 403 forbidden').retry).toBe(false);
  });
  it('maps a missing model with no retry', () => {
    expect(describeError('X', 'HTTP 404 not found').retry).toBe(false);
  });
  it('maps timeouts', () => {
    expect(describeError('X', 'Run deadline exceeded (90s)').title).toBe('The model took too long');
    expect(describeError('X', 'request timed out').retry).toBe(true);
  });
  it('maps unparseable output', () => {
    expect(describeError('X', 'model output unparseable').title).toBe("The model's answer could not be read");
  });
  it('falls back to the first sentence of the message', () => {
    const d = describeError('WEIRD', 'Something odd happened. More detail here.');
    expect(d.title).toBe('The run failed');
    expect(d.sentence).toBe(firstSentence('Something odd happened. More detail here.'));
    expect(d.retry).toBe(true);
  });
});

describe('pageState', () => {
  it('maps every phase/status pair', () => {
    expect(pageState('idle', null)).toBe('idle');
    expect(pageState('starting', null)).toBe('running');
    expect(pageState('polling', 'queued')).toBe('running');
    expect(pageState('start_failed', null)).toBe('failed');
    expect(pageState('stopped', null)).toBe('stopped');
    expect(pageState('contract_mismatch', null)).toBe('contract_mismatch');
    expect(pageState('connection_lost', null)).toBe('connection_lost');
    expect(pageState('done', 'completed')).toBe('completed');
    expect(pageState('done', 'incomplete')).toBe('incomplete');
    expect(pageState('done', 'failed')).toBe('failed');
    expect(pageState('done', 'queued')).toBe('running');
    expect(pageState('done', 'running')).toBe('running');
    expect(pageState('done', null)).toBe('running');
  });
});

describe('stoppedAfterSeconds / formatSeconds', () => {
  it('is null with no events and the elapsed seconds otherwise', () => {
    expect(stoppedAfterSeconds([])).toBeNull();
    const last = sampleEvents[sampleEvents.length - 1];
    if (last === undefined) throw new Error('missing event');
    expect(stoppedAfterSeconds(sampleEvents)).toBe(elapsedSeconds(sampleEvents, last));
    expect(formatSeconds(stoppedAfterSeconds(sampleEvents) ?? -1)).toBe(elapsedSeconds(sampleEvents, last).toFixed(1));
  });
});

describe('hearingGeometry', () => {
  it('is empty geometry when there are no events', () => {
    const g = hearingGeometry([], null);
    expect(g.rails.map(r => r.lane)).toEqual(['rider', 'judge', 'driver', 'risk']);
    expect(g.stations).toHaveLength(0);
    expect(g.segments).toHaveLength(0);
    expect(g.handoff).toBeNull();
    expect(g.end).toBeNull();
    expect(g.domainSeconds).toBe(20);
    expect(g.ticks.map(t => t.label)).toEqual(['0 s', '5 s', '10 s', '15 s', '20 s']);
  });

  it('marks a failed run on the judge lane', () => {
    const evts = [
      event(1, 'system', 'run.started'), event(2, 'rider', 'model.start'),
      event(3, 'driver', 'model.start'), event(4, 'system', 'run.failed'),
    ];
    const g = hearingGeometry(evts, 'failed');
    expect(g.rails).toHaveLength(4);
    expect(g.segments.map(s => s.lane)).toEqual(['rider', 'driver']);
    const last = evts[evts.length - 1];
    if (last === undefined) throw new Error('missing event');
    const expectedX = (elapsedSeconds(evts, last) / g.domainSeconds) * 100;
    expect(g.end?.kind).toBe('failed');
    expect(g.end?.x).toBe(expectedX);
    expect(g.end?.label).toBe(`Failed at ${elapsedSeconds(evts, last).toFixed(1)} s`);
    expect(g.handoff).toBeNull();
    expect(g.stations).toHaveLength(3);
  });

  it('marks handoff and ruling on a completed run', () => {
    const g = hearingGeometry(sampleEvents, 'completed');
    const judgeEvent = sampleEvents.find(e => e.type === 'judge.started');
    if (judgeEvent === undefined) throw new Error('missing judge.started');
    expect(g.handoff?.seconds).toBe(elapsedSeconds(sampleEvents, judgeEvent));
    expect(g.end?.kind).toBe('ruling');
    expect(g.end?.label).toBe('Ruling');
    expect(g.stations.length + (g.handoff === null ? 0 : 1) + (g.end === null ? 0 : 1)).toBe(sampleEvents.length);
    for (const station of g.stations) {
      expect(station.x).toBeGreaterThanOrEqual(0);
      expect(station.x).toBeLessThanOrEqual(100);
    }
    const judgeSegment = g.segments.find(s => s.lane === 'judge');
    expect(judgeSegment?.x1).toBe(g.handoff?.x);
    expect(g.domainSeconds).toBe(20);
  });

  it('uses 10 s ticks beyond a 60 s domain', () => {
    const first = sampleEvents[0];
    if (first === undefined) throw new Error('missing event');
    const shifted = sampleEvents.map(e =>
      e.sequence === 9 ? {...e, timestamp: new Date(Date.parse(first.timestamp) + 70000).toISOString()} : e);
    const g = hearingGeometry(shifted, 'running');
    expect(g.ticks.map(t => t.label)).toContain('10 s');
    expect(g.ticks.map(t => t.label)).not.toContain('5 s');
    expect(g.end).toBeNull();
  });

  it('has no end marker while running', () => {
    expect(hearingGeometry(sampleEvents, 'running').end).toBeNull();
  });

  it('titles stations with actor, event and elapsed seconds', () => {
    const driverEvent = sampleEvents.find(e => e.actor === 'driver' && e.type === 'evidence.retrieved');
    if (driverEvent === undefined) throw new Error('missing driver event');
    const g = hearingGeometry(sampleEvents, 'completed');
    const station = g.stations.find(s => s.sequence === driverEvent.sequence);
    expect(station?.title).toBe(`Driver Advocate: Evidence retrieved, +${elapsedSeconds(sampleEvents, driverEvent).toFixed(1)} s`);
  });

  it('maps risk events to the risk lane and precedent events to the judge lane', () => {
    const evts = [
      event(1, 'system', 'run.started'), event(2, 'risk', 'model.start'),
      event(3, 'risk', 'risk.assessed'), event(4, 'precedent', 'precedent.retrieved'),
      event(5, 'judge', 'judge.started'), event(6, 'system', 'run.completed'),
    ];
    const g = hearingGeometry(evts, 'completed');
    const riskStations = g.stations.filter(s => s.lane === 'risk');
    expect(riskStations.map(s => s.sequence)).toEqual([2, 3]);
    expect(riskStations[1]?.title).toContain('Risk Analyst: risk risk.assessed');
    expect(g.stations.find(s => s.sequence === 4)?.lane).toBe('judge');
    expect(g.stations.find(s => s.sequence === 4)?.title).toContain('Precedent: precedent precedent.retrieved');
    expect(g.segments.map(s => s.lane)).toContain('risk');
    expect(g.handoff?.risk).toBe(true);
  });

  it('snaps stations within the start window to 0 s in the drawing but keeps exact times in titles', () => {
    const at = (sequence: number, actor: ActivityEvent['actor'], type: ActivityEvent['type'], ms: number): ActivityEvent =>
      ({...event(sequence, actor, type), timestamp: new Date(Date.UTC(2026, 9, 2, 13, 30, 0, ms)).toISOString()});
    const evts = [
      at(1, 'system', 'run.started', 0), at(2, 'rider', 'model.start', 40),
      at(3, 'driver', 'model.start', 140), at(4, 'risk', 'model.start', 240),
      at(5, 'driver', 'tool.requested', 900),
    ];
    const g = hearingGeometry(evts, 'running');
    for (const sequence of [2, 3, 4]) expect(g.stations.find(s => s.sequence === sequence)?.x).toBe(0);
    expect(g.stations.find(s => s.sequence === 3)?.title).toContain('+0.1 s');
    expect(g.stations.find(s => s.sequence === 5)?.x).toBeGreaterThan(0);
    expect(g.segments.find(s => s.lane === 'driver')?.x1).toBe(0);
    expect(g.segments.find(s => s.lane === 'risk')?.x1).toBe(0);
  });

  it('draws no risk curve when there are no risk stations or no handoff', () => {
    const g = hearingGeometry(sampleEvents, 'completed');
    expect(g.handoff?.risk).toBe(false);
    const noHandoff = hearingGeometry([event(1, 'risk', 'model.start'), event(2, 'risk', 'risk.assessed')], 'running');
    expect(noHandoff.handoff).toBeNull();
  });
});

describe('routeGauge', () => {
  const facts: Facts = {
    kind: 'route_metrics', referenceMeters: 7960, actualMeters: 10602,
    excessMeters: 2642, excessPct: 33.2, thresholdMeters: 796,
    exceedsThreshold: true, unexpectedStops: [{}],
  };
  it('returns null without the required fields', () => {
    expect(routeGauge({kind: 'route_metrics', excessMeters: 2642})).toBeNull();
    expect(routeGauge({kind: 'fare_breakdown'})).toBeNull();
    expect(routeGauge(undefined)).toBeNull();
    expect(routeGauge(null)).toBeNull();
  });
  it('builds a scaled gauge straight from the facts', () => {
    const gauge = routeGauge(facts);
    if (gauge === null) throw new Error('expected a gauge');
    expect(gauge.caption).toBe('+2,642 m over the reference; RD-1 threshold 796 m: exceeded');
    expect(gauge.stops).toBe(1);
    expect(gauge.actualPct).toBe(100);
    expect(gauge.referencePct).toBeLessThan(gauge.markerPct);
    expect(gauge.actualWithinPct + gauge.actualBeyondPct).toBeCloseTo(gauge.actualPct);
    expect(gauge.actualBeyondPct).toBeGreaterThan(0);
    for (const p of [gauge.referencePct, gauge.actualPct, gauge.markerPct]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
  it('shows no beyond-threshold span when the threshold is not exceeded', () => {
    const gauge = routeGauge({...facts, actualMeters: facts.referenceMeters ?? 0, exceedsThreshold: false});
    if (gauge === null) throw new Error('expected a gauge');
    expect(gauge.actualBeyondPct).toBe(0);
    expect(gauge.actualWithinPct).toBeCloseTo(gauge.actualPct);
  });
});

const pickupFacts: Facts = {
  kind: 'pickup_metrics', closestApproachMeters: 120, maxPickupDistanceMeters: 100,
  minWaitSeconds: 120, waitSecondsWithinThreshold: null,
  checks: {withinDistance: false, waitedMinimum: false},
};

describe('pickupGauge', () => {
  it('reports never within range when the wait is null', () => {
    const gauge = pickupGauge(pickupFacts, null);
    if (gauge === null) throw new Error('expected a gauge');
    expect(gauge.wait.valueText).toBe('Never within range');
    expect(gauge.wait.valuePct).toBeNull();
    expect(gauge.wait.met).toBe(false);
    expect(gauge.distance.met).toBe(false);
    expect(gauge.contact).toBeNull();
  });
  it('adds a contact meter from the chat summary', () => {
    const summary: Facts = {
      kind: 'chat_summary', minContactAttempts: 2,
      driverContactAttemptsBeforeCancel: 3, contactCheckMet: true,
    };
    const gauge = pickupGauge(pickupFacts, summary);
    if (gauge === null || gauge.contact === null) throw new Error('expected contact meter');
    expect(gauge.contact.valueText).toBe('3 attempts');
    expect(gauge.contact.met).toBe(true);
    expect(gauge.contact.limitPct).toBeLessThanOrEqual(100);
  });
  it('returns null for the wrong kind or missing numbers', () => {
    expect(pickupGauge({kind: 'route_metrics'}, null)).toBeNull();
    expect(pickupGauge({kind: 'pickup_metrics'}, null)).toBeNull();
    expect(pickupGauge(undefined, undefined)).toBeNull();
  });
});

describe('paymentGauge', () => {
  const fare: Facts = {
    kind: 'fare_breakdown',
    lineItems: [{code: 'BASE', label: 'Base fare', cents: 480, quantity: null}, {code: 'X', cents: 10}],
    totalCents: 1980, paidCents: 1980,
  };
  it('formats amounts with formatSgd of the input cents', () => {
    const view = paymentGauge(fare, null);
    if (view === null) throw new Error('expected a view');
    expect(view.lineItems).toEqual([{label: 'Base fare', amount: 'S$4.80'}]);
    expect(view.total).toBe('S$19.80');
    expect(view.paid).toBe('S$19.80');
    expect(view.remedies).toHaveLength(0);
  });
  it('lists remedies with amounts or unavailability notes', () => {
    const remedy: Facts = {
      kind: 'remedy_basis',
      basis: [
        {remedyId: 'refund_route_excess', eligibleCents: 198, formula: 'x', unavailableReason: null},
        {remedyId: 'refund_no_show_fee', eligibleCents: null, formula: 'y', unavailableReason: 'not a no-show'},
      ],
    };
    const view = paymentGauge(fare, remedy);
    if (view === null) throw new Error('expected a view');
    expect(view.remedies).toHaveLength(2);
    expect(view.remedies[0]?.amount).toBe('S$1.98');
    expect(view.remedies[1]?.amount).toBeNull();
    expect(view.remedies[1]?.note).toBe('not a no-show');
  });
  it('returns null for the wrong kind or missing numbers', () => {
    expect(paymentGauge({kind: 'remedy_basis'}, null)).toBeNull();
    expect(paymentGauge({kind: 'fare_breakdown'}, null)).toBeNull();
    expect(paymentGauge(undefined, undefined)).toBeNull();
  });
});

const highRisk: RiskAssessment = {
  overall: 'high',
  signals: [{code: 'repeat_subject', party: 'driver', severity: 'high', detail: '6 disputes against in 90 days.', evidenceIds: ['HIST-DRIVER']}],
  summary: 'Driver shows a repeated-complaint pattern.',
  caveat: RISK_CAVEAT,
  source: 'model',
};

function escalatedRun(withReview: boolean): Run {
  const run = completedRun();
  if (run.status !== 'completed') throw new Error('expected completed run');
  return {
    ...run,
    escalation: {reasons: ['high_risk'], confidence: 0.9, threshold: 0.75, summary: 'Escalated for human review (high risk).'},
    ...(withReview
      ? {review: {decision: 'confirmed' as const, decidedAt: '2026-10-02T13:40:00Z', note: 'Checked.', ruling: 'rider_favored' as const, action: run.result.action}}
      : {}),
  };
}

describe('reviewState', () => {
  it('maps escalation and review to none/pending/decided', () => {
    expect(reviewState(completedRun())).toBe('none');
    expect(reviewState(escalatedRun(false))).toBe('pending');
    expect(reviewState(escalatedRun(true))).toBe('decided');
  });
});

function escalatedCompleted(escalation: Escalation, extra: {risk?: RiskAssessment; verdict?: PolicyVerdict; divergence?: RunDivergence} = {}): Run {
  const run = completedRun();
  if (run.status !== 'completed') throw new Error('unreachable');
  return {...run, escalation, ...extra};
}

const divergentVerdict: PolicyVerdict = {
  outcome: 'keep_charge', clauseIds: ['RD-1', 'RD-4'], basis: 'the reroute was documented',
  features: ['rd1_exceeded', 'documented_reroute'], missingFamilies: []
};

describe('escalationLines', () => {
  it('writes one sentence per reason', () => {
    const run = escalatedCompleted(
      {reasons: ['low_confidence', 'high_risk'], confidence: 0.9, threshold: 0.75, summary: 'x'},
      {risk: highRisk});
    expect(escalationLines(run)).toEqual([
      'Judge confidence 0.90 is below the 0.75 review threshold',
      'Risk high — Driver shows a repeated-complaint pattern.',
    ]);
  });

  it('explains policy_divergence with the verdict, clauses and the Judge remedy', () => {
    const run = escalatedCompleted(
      {reasons: ['policy_divergence'], confidence: 0.9, threshold: 0.8, summary: 'x'},
      {verdict: divergentVerdict, divergence: {judgeRemedyId: 'refund_route_excess', verdictOutcome: 'keep_charge', summary: 'x'}});
    expect(escalationLines(run)).toEqual([
      'The policy rules give Keep the charge (no refund) under RD-1, RD-4; the Judge chose Refund the excess-distance charge. Nothing is paid until a reviewer decides.',
    ]);
  });

  it('explains policy_undetermined with the verdict basis', () => {
    const verdict: PolicyVerdict = {outcome: 'undetermined', clauseIds: ['RD-3'], basis: 'conflicting rider chat signals: consent and objection', features: ['rd1_exceeded', 'rider_agreement', 'rider_objection'], missingFamilies: []};
    const run = escalatedCompleted({reasons: ['policy_undetermined'], confidence: 0.9, threshold: 0.8, summary: 'x'}, {verdict});
    expect(escalationLines(run)).toEqual([
      "The policy rules could not determine this case (conflicting rider chat signals: consent and objection); the Judge's ruling is a recommendation until a reviewer decides.",
    ]);
  });

  it('returns a line for every escalation reason — the switch is exhaustive over the enum', () => {
    const reasons: Escalation['reasons'] = ['low_confidence', 'high_risk', 'policy_divergence', 'policy_undetermined'];
    const verdict: PolicyVerdict = {outcome: 'undetermined', clauseIds: ['RD-3'], basis: 'conflicting signals', features: [], missingFamilies: []};
    const run = escalatedCompleted(
      {reasons, confidence: 0.9, threshold: 0.8, summary: 'x'},
      {risk: highRisk, verdict, divergence: {judgeRemedyId: 'refund_route_excess', verdictOutcome: 'undetermined', summary: 'x'}});
    const lines = escalationLines(run);
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(line.length).toBeGreaterThan(0);
  });
});

describe('policy verdict presentation', () => {
  const divergentRun = escalatedCompleted(
    {reasons: ['policy_divergence'], confidence: 0.9, threshold: 0.8, summary: 'x'},
    {verdict: divergentVerdict, divergence: {judgeRemedyId: 'refund_route_excess', verdictOutcome: 'keep_charge', summary: 'x'}});

  it('labels verdict outcomes, including the non-remedy ones', () => {
    expect(verdictOutcomeLabel('keep_charge')).toBe('Keep the charge (no refund)');
    expect(verdictOutcomeLabel('refund_route_excess')).toBe('Refund the excess-distance charge');
    expect(verdictOutcomeLabel('incomplete')).toBe('Incomplete — decisive evidence missing');
    expect(verdictOutcomeLabel('undetermined')).toBe('Undetermined by the policy rules');
  });

  it('changes the review headline when the Judge disagrees', () => {
    expect(reviewHeadline(divergentRun)).toBe('Sent to human review — Judge disagrees with the policy rules');
    expect(reviewHeadline(completedRun())).toBe('Sent to human review');
  });

  it('builds the two-line policy/Judge comparison', () => {
    expect(divergenceComparison(divergentRun)).toEqual({
      policy: 'Policy rules: Keep the charge (no refund) (RD-1, RD-4)',
      judge: 'Judge: Refund the excess-distance charge · confidence 86%',
    });
    expect(divergenceComparison(completedRun())).toBeNull();
  });

  it('offers the verdict remedy only when it differs and is a remedy', () => {
    expect(policyVerdictRemedy(divergentRun)).toBe('keep_charge');
    expect(policyVerdictRemedy(completedRun())).toBeNull();
    const matching = escalatedCompleted(
      {reasons: ['policy_divergence'], confidence: 0.9, threshold: 0.8, summary: 'x'},
      {verdict: {...divergentVerdict, outcome: 'refund_route_excess'}});
    expect(policyVerdictRemedy(matching)).toBeNull();
    const undetermined = escalatedCompleted(
      {reasons: ['policy_undetermined'], confidence: 0.9, threshold: 0.8, summary: 'x'},
      {verdict: {outcome: 'undetermined', clauseIds: ['RD-3'], basis: 'x', features: [], missingFamilies: []}});
    expect(policyVerdictRemedy(undetermined)).toBeNull();
  });

  it('summarises the verdict for the Judge column and flags agreement', () => {
    expect(verdictLine(divergentVerdict)).toBe('Keep the charge (no refund) — RD-1, RD-4 — the reroute was documented');
    expect(verdictAgreement(divergentVerdict, 'keep_charge')).toBe('Judge agrees with the policy rules.');
    expect(verdictAgreement(divergentVerdict, 'refund_route_excess')).toBeNull();
    expect(verdictAgreement(undefined, 'keep_charge')).toBeNull();
  });

  it('writes the automatic re-run note', () => {
    expect(retryNote('The operation was aborted due to timeout')).toBe('First attempt failed (provider timeout); this is the automatic re-run.');
    expect(retryNote('fetch failed')).toBe('First attempt failed (workflow failure); this is the automatic re-run.');
  });
});

describe('remedyOptions', () => {
  it('lists the category remedies', () => {
    expect(remedyOptions('route_deviation').map(option => option.id)).toEqual(['keep_charge', 'refund_route_excess']);
    expect(remedyOptions('no_show').map(option => option.id)).toEqual(['keep_charge', 'refund_no_show_fee']);
    expect(remedyOptions('route_deviation').map(option => option.label)).toEqual(['Keep the charge (no refund)', 'Refund the excess-distance charge']);
  });
});

describe('stretch labels', () => {
  it('labels risk levels', () => {
    expect(riskLevelLabel('low')).toBe('Low risk');
    expect(riskLevelLabel('medium')).toBe('Medium risk');
    expect(riskLevelLabel('high')).toBe('High risk');
  });
  it('labels signal codes and falls back to the code', () => {
    expect(signalLabel('repeat_subject')).toBe('Repeated complaints against');
    expect(signalLabel('instruction_like_chat')).toBe('Instruction-like chat');
    expect(signalLabel('other_code')).toBe('other_code');
  });
  it('labels precedent origins', () => {
    expect(precedentOriginLabel('seed')).toBe('Seed case');
    expect(precedentOriginLabel('run')).toBe('Earlier run');
    expect(precedentOriginLabel('human_override')).toBe('Human override');
  });
  it('labels the new actors and event types', () => {
    expect(actorDisplay('risk')).toBe('Risk Analyst');
    expect(actorDisplay('precedent')).toBe('Precedent');
    expect(actorDisplay('judge')).toBe('Judge');
    expect(eventDisplay('risk.assessed')).toBe('Risk assessed');
    expect(eventDisplay('precedent.retrieved')).toBe('Precedents retrieved');
    expect(eventDisplay('run.escalated')).toBe('Escalated for human review');
    expect(eventDisplay('review.decided')).toBe('Review decided');
    expect(eventDisplay('run.completed')).toBe('Ruling issued');
  });
});
