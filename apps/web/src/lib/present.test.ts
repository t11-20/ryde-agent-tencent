import { describe, expect, it } from 'vitest';
import { completedRun, event, sampleEvents } from './test-runs.js';
import { elapsedSeconds } from './events.js';
import {
  actionHeadline, categoryLabel, clauseLabel, describeError, evidenceLabel, firstSentence,
  formatCount, formatSeconds, hearingGeometry, pageState, partitionClauses, paymentGauge,
  pickupGauge, plural, routeGauge, sgtTime, stageOf, stoppedAfterSeconds,
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
    expect(g.rails.map(r => r.lane)).toEqual(['rider', 'judge', 'driver']);
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
    expect(g.rails).toHaveLength(3);
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
