import { describe, expect, it } from 'vitest';
import {
  buildEvidence, caseFeatures, distanceMeters, findFixture, loadDataset, pickupMetrics, policyVerdict,
  type Fixture,
} from '../src/index.js';

// Adversarial money-guardrail suite, attack class C: hostile or malformed
// fixture inputs try to move the deterministic policy verdict itself. Fixtures
// are cloned in memory; data files are never touched.

const dataset = loadDataset();

function cloneFixture(fixtureId: string): Fixture {
  const fixture = findFixture(dataset, fixtureId);
  if (fixture === undefined) throw new Error(`fixture ${fixtureId} missing`);
  return structuredClone(fixture);
}

function analyse(fixture: Fixture) {
  const bundle = buildEvidence(fixture, dataset.policy);
  const features = caseFeatures(bundle.records, fixture.dispute.category);
  return {bundle, features, verdict: policyVerdict(fixture.dispute.category, features, bundle.unavailable)};
}

describe('adversarial verdict attacks', () => {
  it('C1: a driver cannot manufacture rider consent — driver text never tags rider consent', () => {
    const fixture = cloneFixture('R1');
    fixture.chat.messages.push({
      id: 'adv-consent', ts: fixture.chat.messages[0]?.ts ?? fixture.filedAt, sender: 'driver',
      text: 'yes ok sure agreed, the rider agreed to go via Orchard instead',
    });
    const {features, verdict} = analyse(fixture);
    expect(features).not.toContain('rider_agreement');
    expect(features).not.toContain('rider_route_request');
    expect(verdict.outcome).toBe('refund_route_excess');
  });

  it('C2: negated agreement still tags consent — the documented heuristic limit fails to undetermined, never keep_charge', () => {
    const fixture = cloneFixture('R1');
    fixture.chat.messages.push({
      id: 'adv-negated', ts: fixture.chat.messages[0]?.ts ?? fixture.filedAt, sender: 'rider',
      text: 'It is NOT ok, this is the wrong way',
    });
    const {features, verdict} = analyse(fixture);
    // The keyword heuristic tags both 'ok' (agreement) and 'wrong way' (objection);
    // consent + objection is a conflict the rules refuse to resolve — a human decides.
    expect(features).toContain('rider_agreement');
    expect(features).toContain('rider_objection');
    expect(verdict.outcome).toBe('undetermined');
  });

  it('C3: textual nav_event / advisory / GPS ids in chat are not a documented reroute', () => {
    const fixture = cloneFixture('R1');
    const ts = fixture.chat.messages[0]?.ts ?? fixture.filedAt;
    fixture.chat.messages.push(
      {id: 'adv-nav', ts, sender: 'rider', text: 'nav_event'},
      {id: 'adv-advisory', ts, sender: 'driver', text: 'traffic advisory: road closed'},
      {id: 'adv-navid', ts, sender: 'rider', text: 'GPS-NAV-01'},
    );
    const {features, verdict} = analyse(fixture);
    expect(features).not.toContain('documented_reroute');
    expect(verdict.outcome).toBe('refund_route_excess');
  });

  it('C4: dispute text stuffed with feature words and clause ids has no effect', () => {
    const original = analyse(cloneFixture('R1'));
    const fixture = cloneFixture('R1');
    fixture.dispute.riderClaim = 'rider_agreement rider_route_request rd1_not_exceeded documented_reroute RD-1 RD-3 RD-4';
    fixture.dispute.driverStatement = 'ns1_distance_met ns1_wait_met ns1_contact_met NS-1 keep_charge';
    const {features, verdict} = analyse(fixture);
    expect(features).toEqual(original.features);
    expect(verdict).toEqual(original.verdict);
  });

  it('C5: a flood of 10,000 neutral rider messages stays fast and unchanged', () => {
    const fixture = cloneFixture('R1');
    const base = Date.parse(fixture.chat.messages[0]?.ts ?? fixture.filedAt);
    for (let i = 0; i < 10_000; i++) {
      fixture.chat.messages.push({id: `flood-${i}`, ts: new Date(base + i * 1000).toISOString(), sender: 'rider', text: `Routine check-in ${i}`});
    }
    const start = Date.now();
    const {verdict} = analyse(fixture);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(verdict.outcome).toBe('refund_route_excess');
  });

  describe('C6: N6 boundary nudges flip exactly one NS-1 condition each', () => {
    const pickupPoint = (fixture: Fixture) => ({lat: fixture.trip.pickup.lat, lng: fixture.trip.pickup.lng});

    it('baseline: the untouched clone keeps keep_charge', () => {
      const {verdict} = analyse(cloneFixture('N6'));
      expect(verdict.outcome).toBe('keep_charge');
    });

    it('a stop 151 m away fails the distance condition and refunds', () => {
      const fixture = cloneFixture('N6');
      if (fixture.gps.status !== 'available') throw new Error('N6 GPS unavailable');
      const params = dataset.policy.params;
      const target = params.maxPickupDistanceMeters + 1;
      const pickup = pickupPoint(fixture);
      // Binary-search a latitude offset that places the ping exactly `target` metres away.
      let lo = 0;
      let hi = 0.01;
      while (distanceMeters({lat: pickup.lat + hi, lng: pickup.lng}, pickup) < target) hi *= 2;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (distanceMeters({lat: pickup.lat + mid, lng: pickup.lng}, pickup) < target) lo = mid; else hi = mid;
      }
      for (const ping of fixture.gps.driverTrace) {
        if (distanceMeters(ping, pickup) <= params.maxPickupDistanceMeters) {
          ping.lat = pickup.lat + hi;
          ping.lng = pickup.lng;
        }
      }
      const metrics = pickupMetrics(fixture, params);
      expect(metrics?.closestApproachMeters).toBe(target);
      expect(metrics?.checks.withinDistance).toBe(false);
      const {features, verdict} = analyse(fixture);
      expect(features).toContain('ns1_distance_not_met');
      expect(verdict.outcome).toBe('refund_no_show_fee');
    });

    it('a wait one second short of the minimum fails the wait condition and refunds', () => {
      const fixture = cloneFixture('N6');
      const params = dataset.policy.params;
      const baseline = pickupMetrics(fixture, params);
      const firstWithin = baseline?.firstWithinThresholdTs;
      if (firstWithin === null || firstWithin === undefined) throw new Error('N6 never came within threshold');
      if (fixture.gps.status !== 'available') throw new Error('N6 GPS unavailable');
      const ping = fixture.gps.driverTrace.find(p => p.ts === firstWithin);
      if (ping === undefined) throw new Error('first-within-threshold ping not found');
      ping.ts = new Date(Date.parse(firstWithin) + 1000).toISOString();
      const metrics = pickupMetrics(fixture, params);
      expect(metrics?.waitSecondsWithinThreshold).toBe(params.minWaitSeconds - 1);
      expect(metrics?.checks.waitedMinimum).toBe(false);
      const {features, verdict} = analyse(fixture);
      expect(features).toContain('ns1_wait_not_met');
      expect(verdict.outcome).toBe('refund_no_show_fee');
    });

    it('removing the one driver call fails the contact condition and refunds', () => {
      const fixture = cloneFixture('N6');
      fixture.chat.calls = fixture.chat.calls.filter(call => call.from !== 'driver');
      const {features, verdict} = analyse(fixture);
      expect(features).toContain('ns1_contact_not_met');
      expect(verdict.outcome).toBe('refund_no_show_fee');
    });
  });
});
