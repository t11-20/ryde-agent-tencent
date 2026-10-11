import { describe, expect, it } from 'vitest';
import { DisputeSchema, PolicyClauseSchema } from '@fairtrip/contracts';
import { findExpected, findFixture, findFixtureByDisputeId, loadDataset } from '../src/index.js';

const CANONICAL_FIXTURE_IDS = ['R1', 'R1S', 'R2', 'R3', 'X1', 'N1', 'N2', 'N2H', 'N3', 'X2', 'X3'];

describe('dataset loader', () => {
  it('loads the eleven fixtures in the canonical expected-outcome order', () => {
    const fixtureIds = loadDataset().fixtures.map(fixture => fixture.fixtureId);
    expect(fixtureIds).toEqual(CANONICAL_FIXTURE_IDS);
  });

  it('loads the demonstration policy with 11 contract-valid clauses', () => {
    const { policy } = loadDataset();
    expect(policy.label).toBe('DEMONSTRATION POLICY');
    expect(policy.clauses).toHaveLength(11);
    expect(policy.clauses.filter(clause => clause.category === 'route_deviation')).toHaveLength(7);
    expect(policy.clauses.filter(clause => clause.category === 'no_show')).toHaveLength(4);
    for (const clause of policy.clauses) {
      expect(() => PolicyClauseSchema.parse(clause)).not.toThrow();
    }
  });

  it('validates every fixture dispute against the Lane A contract', () => {
    for (const fixture of loadDataset().fixtures) {
      expect(() => DisputeSchema.parse(fixture.dispute)).not.toThrow();
      expect(fixture.dispute.id).toBe('DSP-' + fixture.fixtureId);
    }
  });

  it('reproduces the expected outcomes of SPEC §4.3', () => {
    const dataset = loadDataset();
    const expectedAmounts: Record<string, number> = {R1: 198, R1S: 297, N1: 500, N3: 500, R2: 0};
    for (const [fixtureId, cents] of Object.entries(expectedAmounts)) {
      expect(findExpected(dataset, fixtureId)?.expectedAmountCents).toBe(cents);
    }
    for (const fixtureId of ['X1', 'X3']) {
      const outcome = findExpected(dataset, fixtureId);
      expect(outcome?.expectedAmountCents).toBeNull();
      expect(outcome?.expectedStatus).toBe('incomplete');
    }
  });

  it('caches the dataset between calls', () => {
    expect(loadDataset()).toBe(loadDataset());
  });

  it('finds fixtures by id and by dispute id', () => {
    const dataset = loadDataset();
    expect(findFixtureByDisputeId(dataset, 'DSP-N2')?.fixtureId).toBe('N2');
    expect(findFixtureByDisputeId(dataset, 'DSP-UNKNOWN')).toBeUndefined();
    expect(findFixture(dataset, 'N2')?.dispute.id).toBe('DSP-N2');
    expect(findFixture(dataset, 'UNKNOWN')).toBeUndefined();
  });
});
