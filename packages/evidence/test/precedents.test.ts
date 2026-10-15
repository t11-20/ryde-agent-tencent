import { describe, expect, it } from 'vitest';
import {
  buildEvidence,
  caseFeatures,
  FEATURE_VOCABULARY,
  findFixture,
  loadDataset,
  loadPrecedentSeed,
  matchPrecedents,
} from '../src/index.js';
import type { Precedent } from '@fairtrip/contracts';

const store = loadPrecedentSeed();
const vocabulary = new Set(FEATURE_VOCABULARY);
const ds = loadDataset();

function fixtureFeatures(fixtureId: string): string[] {
  const fixture = findFixture(ds, fixtureId);
  if (fixture === undefined) throw new Error(`${fixtureId} not found`);
  return caseFeatures(buildEvidence(fixture, ds.policy).records, fixture.dispute.category);
}

function precedent(id: string, decidedAt: string, features: string[]): Precedent {
  return {
    id, category: 'route_deviation', decidedAt, origin: 'seed',
    ruling: 'driver_favored', remedyId: 'keep_charge', features,
    summary: 'Synthetic precedent: a test precedent.',
  };
}

describe('precedent store', () => {
  it('loads the seed file with unique ids, seed origin and vocabulary features', () => {
    expect(store).toHaveLength(8);
    expect(new Set(store.map(p => p.id)).size).toBe(8);
    for (const p of store) {
      expect(p.origin).toBe('seed');
      expect(p.summary.startsWith('Synthetic precedent:')).toBe(true);
      for (const feature of p.features) expect(vocabulary.has(feature)).toBe(true);
    }
  });

  it('ranks the strongest feature match first', () => {
    const matches = matchPrecedents(store, 'route_deviation', ['rd1_exceeded', 'rider_objection']);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.remedyId).toBe('refund_route_excess');
    expect(matches[0]?.features).toContain('rider_objection');
  });

  it('excludes precedents from the other category', () => {
    const matches = matchPrecedents(store, 'route_deviation', ['ns1_distance_met', 'ns1_wait_met', 'ns1_contact_met']);
    expect(matches).toHaveLength(0);
    for (const p of matchPrecedents(store, 'route_deviation', ['rd1_exceeded']))
      expect(p.category).toBe('route_deviation');
  });

  it('drops precedents sharing no features and respects the limit', () => {
    expect(matchPrecedents(store, 'route_deviation', ['ns1_distance_met'])).toHaveLength(0);
    const many = matchPrecedents(store, 'route_deviation', ['rd1_exceeded'], 2);
    expect(many).toHaveLength(2);
  });

  it('excludes precedents whose features conflict with the case', () => {
    const matches = matchPrecedents(store, 'no_show', ['ns1_distance_not_met', 'ns1_wait_met', 'ns1_contact_met']);
    expect(matches[0]?.id).toBe('PREC-006');
    expect(matches.some(p => p.id === 'PREC-005')).toBe(false);
  });

  it('excludes every exceeded seed when the case did not exceed', () => {
    const matches = matchPrecedents(store, 'route_deviation', ['rd1_not_exceeded']);
    expect(matches.some(p => p.features.includes('rd1_exceeded'))).toBe(false);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('R4 matches exactly PREC-004 (the only seed without a conflicting feature)', () => {
    const matches = matchPrecedents(store, 'route_deviation', fixtureFeatures('R4'));
    expect(matches.map(p => p.id)).toEqual(['PREC-004']);
  });

  it('N4 matches PREC-008 and not PREC-005', () => {
    const matches = matchPrecedents(store, 'no_show', fixtureFeatures('N4'));
    expect(matches.some(p => p.id === 'PREC-008')).toBe(true);
    expect(matches.some(p => p.id === 'PREC-005')).toBe(false);
  });

  it('breaks score ties by the later decidedAt', () => {
    const earlier = precedent('P-OLD', '2026-09-01T00:00:00.000Z', ['rd1_exceeded']);
    const later = precedent('P-NEW', '2026-09-20T00:00:00.000Z', ['rd1_exceeded']);
    const matches = matchPrecedents([earlier, later], 'route_deviation', ['rd1_exceeded']);
    expect(matches[0]?.id).toBe('P-NEW');
  });
});
