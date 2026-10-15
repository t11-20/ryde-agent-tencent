import { describe, expect, it } from 'vitest';
import {
  buildEvidence, caseFeatures, createFixtureSource, loadDataset, policyVerdict,
} from '../src/index.js';

// The deterministic verdict must reproduce every expected outcome from the
// case features and unavailable families alone — this is the determinism
// guarantee the API enforces against divergent Judge rulings.
const dataset = loadDataset();
const source = createFixtureSource(dataset);

function verdictFor(fixtureId: string) {
  const fixture = dataset.fixtures.find(f => f.fixtureId === fixtureId);
  if (fixture === undefined) throw new Error(`no fixture ${fixtureId}`);
  const bundle = buildEvidence(fixture, dataset.policy);
  return policyVerdict(fixture.dispute.category, caseFeatures(bundle.records, fixture.dispute.category), bundle.unavailable);
}

describe('policyVerdict reproduces every expected outcome', () => {
  it.each(dataset.expected)('$fixtureId', (expected) => {
    const verdict = verdictFor(expected.fixtureId);
    const wanted = expected.expectedStatus === 'incomplete' ? 'incomplete' : expected.expectedRemedyId;
    expect(verdict.outcome).toBe(wanted);
    // The DisputeSource accessor agrees with the pure function.
    const fixture = dataset.fixtures.find(f => f.fixtureId === expected.fixtureId);
    if (fixture === undefined) throw new Error('unreachable');
    expect(source.policyVerdict(fixture.dispute)).toEqual(verdict);
  });

  it.each(['X1', 'X4'])('%s reports its missing family and the incomplete clause', (fixtureId) => {
    const expected = dataset.expected.find(e => e.fixtureId === fixtureId);
    if (expected === undefined) throw new Error('unreachable');
    const verdict = verdictFor(fixtureId);
    expect(verdict.clauseIds).toEqual(['RD-6']);
    expect(verdict.missingFamilies).toEqual(expected.missingFamilies);
  });
});

describe('policyVerdict branches', () => {
  it('undetermined when rider chat shows consent and objection', () => {
    const verdict = policyVerdict('route_deviation', ['rd1_exceeded', 'rider_agreement', 'rider_objection'], []);
    expect(verdict.outcome).toBe('undetermined');
    expect(verdict.clauseIds).toEqual(['RD-3']);
    expect(verdict.basis).toBe('conflicting rider chat signals: consent and objection');
  });

  it('undetermined when there are no route metrics', () => {
    const verdict = policyVerdict('route_deviation', ['rider_objection'], []);
    expect(verdict.outcome).toBe('undetermined');
    expect(verdict.clauseIds).toEqual(['RD-1']);
  });

  it('undetermined when there are no pickup or contact metrics', () => {
    const verdict = policyVerdict('no_show', ['location_claim'], []);
    expect(verdict.outcome).toBe('undetermined');
    expect(verdict.clauseIds).toEqual(['NS-1']);
  });

  it('incomplete when a decisive family is unavailable', () => {
    const verdict = policyVerdict('no_show', ['ns1_distance_met'], [{family: 'payment', reason: 'no record'}]);
    expect(verdict.outcome).toBe('incomplete');
    expect(verdict.clauseIds).toEqual(['NS-3']);
    expect(verdict.missingFamilies).toEqual(['payment']);
    expect(verdict.basis).toContain('payment');
  });

  it('route_deviation clause lists name the deciding clauses', () => {
    expect(policyVerdict('route_deviation', ['rd1_not_exceeded'], []).clauseIds).toEqual(['RD-1', 'RD-5']);
    expect(policyVerdict('route_deviation', ['rd1_exceeded', 'rider_agreement'], []).clauseIds).toEqual(['RD-1', 'RD-3']);
    expect(policyVerdict('route_deviation', ['rd1_exceeded', 'documented_reroute'], []).clauseIds).toEqual(['RD-1', 'RD-4']);
    expect(policyVerdict('route_deviation', ['rd1_exceeded', 'rider_objection'], []).clauseIds).toEqual(['RD-1', 'RD-2']);
  });

  it('no_show refund basis names the failed conditions', () => {
    const verdict = policyVerdict('no_show', ['ns1_distance_met', 'ns1_wait_not_met', 'ns1_contact_met'], []);
    expect(verdict.outcome).toBe('refund_no_show_fee');
    expect(verdict.clauseIds).toEqual(['NS-1', 'NS-2']);
    expect(verdict.basis).toContain('wait');
  });
});
