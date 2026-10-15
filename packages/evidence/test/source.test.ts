import { describe, expect, it } from 'vitest';
import { createFixtureSource, findFixture, loadDataset, SOURCE_NOTICE } from '../src/index.js';

const ds = loadDataset();
const source = createFixtureSource(ds);
const signal = new AbortController().signal;

// Canonical fixture order (SPEC §4.3, the expected-outcomes order the loader enforces).
const CANONICAL_FIXTURE_IDS = ['R1', 'R1S', 'R2', 'R3', 'R4', 'R1F', 'X1', 'X4', 'N1', 'N1R', 'N2', 'N2H', 'N3', 'N4', 'N5', 'N6', 'X2', 'X3', 'X5', 'X6'];

function disputeOf(fixtureId: string) {
  const dispute = source.getDispute(fixtureId);
  if (dispute === undefined) throw new Error(`no dispute for ${fixtureId}`);
  return dispute;
}

describe('createFixtureSource — notice, listing and lookup (SPEC §8)', () => {
  it('labels the data as synthetic fixtures and demonstration policy', () => {
    expect(source.notice).toBe(SOURCE_NOTICE);
    expect(source.notice).toBe('SYNTHETIC fixtures and DEMONSTRATION POLICY (not Ryde data or Ryde policy).');
  });

  it('lists 20 fixtures in canonical order, every kind === "fixture"', () => {
    const listing = source.listFixtures();
    expect(listing).toHaveLength(20);
    expect(listing.map(item => item.id)).toEqual(CANONICAL_FIXTURE_IDS);
    expect(listing.every(item => item.kind === 'fixture')).toBe(true);
  });

  it("R1's riderClaim equals the fixture's claim", () => {
    const fixture = findFixture(ds, 'R1');
    const r1 = source.listFixtures().find(item => item.id === 'R1');
    expect(fixture).toBeDefined();
    expect(r1?.riderClaim).toBe(fixture?.dispute.riderClaim);
  });

  it("getDispute('R1')?.id === 'DSP-R1' and unknown ids are undefined", () => {
    expect(source.getDispute('R1')?.id).toBe('DSP-R1');
    expect(source.getDispute('NOPE')).toBeUndefined();
  });
});

describe('createFixtureSource — tools bound to a dispute (SPEC §8)', () => {
  it("R1 getEvidence({sources:['gps']}) returns only GPS-ROUTE", async () => {
    const tools = source.createTools(disputeOf('R1'));
    const gps = await tools.getEvidence({ sources: ['gps'] }, signal);
    expect(gps.map(record => record.id)).toEqual(['GPS-ROUTE']);
  });

  it("R1 getEvidence({sources:['chat','history']}) returns chat then history in catalogue order", async () => {
    const tools = source.createTools(disputeOf('R1'));
    const records = await tools.getEvidence({ sources: ['chat', 'history'] }, signal);
    expect(records.map(record => record.id)).toEqual([
      'CHAT-01', 'CHAT-02', 'CHAT-03', 'CHAT-04', 'CHAT-SUMMARY', 'HIST-RIDER', 'HIST-DRIVER',
    ]);
  });

  it('R1 getPolicy is bound to the dispute category (7 RD clauses even when no_show is requested)', async () => {
    const tools = source.createTools(disputeOf('R1'));
    const clauses = await tools.getPolicy({ category: 'no_show' }, signal);
    expect(clauses).toHaveLength(7);
    expect(clauses.map(clause => clause.id)).toEqual(['RD-1', 'RD-2', 'RD-3', 'RD-4', 'RD-5', 'RD-6', 'RD-7']);
    expect(clauses.every(clause => clause.category === 'route_deviation')).toBe(true);
  });
});

describe('createFixtureSource — allEvidence (SPEC §8)', () => {
  it('N2 has 10 evidence records', () => {
    expect(source.allEvidence(disputeOf('N2'))).toHaveLength(10);
  });

  it('throws for an unknown dispute', () => {
    const bogus = disputeOf('R1');
    bogus.id = 'DSP-UNKNOWN';
    expect(() => source.allEvidence(bogus)).toThrow();
  });
});

describe('createFixtureSource — calculation provider reads PAY-REMEDY / PAY-FARE (SPEC §8)', () => {
  const providerFor = (fixtureId: string) => source.calculationProvider(disputeOf(fixtureId));
  const evidenceFor = (fixtureId: string) => source.allEvidence(disputeOf(fixtureId));

  it('calculateRouteExcess: R1 198 eligible, R1S 297 eligible', () => {
    expect(providerFor('R1').calculateRouteExcess(evidenceFor('R1'))).toEqual({ amountCents: 198, eligible: true });
    expect(providerFor('R1S').calculateRouteExcess(evidenceFor('R1S'))).toEqual({ amountCents: 297, eligible: true });
  });

  it('getNoShowFee: N1 500 eligible; R1 null; X1 route null', () => {
    expect(providerFor('N1').getNoShowFee(evidenceFor('N1'))).toEqual({ amountCents: 500, eligible: true });
    expect(providerFor('R1').getNoShowFee(evidenceFor('R1'))).toBeNull();
    expect(providerFor('X1').calculateRouteExcess(evidenceFor('X1'))).toBeNull();
  });

  it('getPaidChargeCap: R1 1473, R1S 1910, N2 500, X3 0', () => {
    expect(providerFor('R1').getPaidChargeCap(evidenceFor('R1'))).toBe(1473);
    expect(providerFor('R1S').getPaidChargeCap(evidenceFor('R1S'))).toBe(1910);
    expect(providerFor('N2').getPaidChargeCap(evidenceFor('N2'))).toBe(500);
    expect(providerFor('X3').getPaidChargeCap(evidenceFor('X3'))).toBe(0);
  });
});

describe('createFixtureSource — missingDecisiveEvidence (SPEC §8)', () => {
  it('reports the gps gap for X1, the payment outage for X3, nothing for R1', () => {
    expect(source.missingDecisiveEvidence(disputeOf('X1'))).toEqual([
      'gps: No location data received from the driver app for this trip (synthetic telemetry gap).',
    ]);
    expect(source.missingDecisiveEvidence(disputeOf('X3'))).toEqual([
      'payment: Payment record not received from the billing service (synthetic outage).',
    ]);
    expect(source.missingDecisiveEvidence(disputeOf('R1'))).toEqual([]);
  });
});
