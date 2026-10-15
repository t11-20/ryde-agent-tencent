import { describe, expect, it } from 'vitest';
import { RISK_CAVEAT } from '@fairtrip/contracts';
import type { Evidence } from '@fairtrip/contracts';
import {
  assessRisk,
  buildEvidence,
  findFixture,
  loadDataset,
  RISK_PARAMS,
  type Fixture,
} from '../src/index.js';

const ds = loadDataset();
const policy = ds.policy;

function fixtureOf(id: string): Fixture {
  const f = findFixture(ds, id);
  if (f === undefined) throw new Error(`${id} not found`);
  return f;
}

function bundleOf(id: string) {
  return buildEvidence(fixtureOf(id), policy);
}

function historyRecord(fields: Record<string, unknown>): Evidence {
  return {
    id: 'HIST-TEST',
    source: 'history',
    timestamp: '2026-10-01T00:00:00.000Z',
    facts: {
      kind: 'party_history', party: 'rider', partyId: 'TEST-PARTY',
      accountAgeDays: RISK_PARAMS.newAccountDays + 1, rating: RISK_PARAMS.lowRating,
      completedTrips: 10,
      disputesFiled90d: RISK_PARAMS.frequentFilerDisputes90d - 1,
      disputesAgainst90d: RISK_PARAMS.repeatSubjectMedium90d - 1,
      caveat: 'Context only; cannot establish fault.',
      ...fields,
    },
    provenance: { kind: 'fixture', description: 'Synthetic boundary-check history record' },
  };
}

function codesFor(record: Evidence): string[] {
  return assessRisk([record]).signals.map(s => s.code);
}

describe('assessRisk', () => {
  it('N2H flags the driver with repeat subject, low rating and a new account', () => {
    const assessment = assessRisk(bundleOf('N2H').records);
    const driver = assessment.signals.filter(s => s.party === 'driver');
    expect(driver.some(s => s.code === 'repeat_subject' && s.severity === 'high')).toBe(true);
    expect(driver.some(s => s.code === 'low_rating')).toBe(true);
    expect(driver.some(s => s.code === 'new_account')).toBe(true);
    expect(assessment.signals.some(s => s.party === 'rider')).toBe(false);
    expect(assessment.overall).toBe('high');
  });

  it('X2 flags instruction-like chat text from the rider as high', () => {
    const assessment = assessRisk(bundleOf('X2').records);
    const flagged = assessment.signals.find(s => s.code === 'instruction_like_chat');
    expect(flagged?.party).toBe('rider');
    expect(flagged?.severity).toBe('high');
    expect(assessment.overall).toBe('high');
  });

  it('R1 emits no signals and stays low', () => {
    const assessment = assessRisk(bundleOf('R1').records);
    expect(assessment.overall).toBe('low');
    expect(assessment.signals).toHaveLength(0);
    expect(assessment.summary).toBe('No risk signals in the retrieved history or chat records.');
  });

  it.each(['R4', 'N4', 'N6'])('%s emits no signals and stays low', (id) => {
    const assessment = assessRisk(bundleOf(id).records);
    expect(assessment.overall).toBe('low');
    expect(assessment.signals).toHaveLength(0);
  });

  it('R1F flags exactly the four rider signals, high overall, none on the driver', () => {
    const assessment = assessRisk(bundleOf('R1F').records);
    const expected = new Map<string, 'low' | 'medium' | 'high'>([
      ['instruction_like_chat', 'high'],
      ['frequent_filer', 'medium'],
      ['low_rating', 'medium'],
      ['new_account', 'low'],
    ]);
    expect(assessment.signals).toHaveLength(4);
    for (const signal of assessment.signals) {
      expect(signal.party).toBe('rider');
      expect(expected.get(signal.code)).toBe(signal.severity);
    }
    expect(assessment.overall).toBe('high');
  });

  it('N1R flags only the rider: repeat_subject high, low_rating and threat medium', () => {
    const assessment = assessRisk(bundleOf('N1R').records);
    const expected = new Map<string, 'low' | 'medium' | 'high'>([
      ['repeat_subject', 'high'],
      ['low_rating', 'medium'],
      ['threat_in_chat', 'medium'],
    ]);
    expect(assessment.signals).toHaveLength(3);
    for (const signal of assessment.signals) {
      expect(signal.party).toBe('rider');
      expect(expected.get(signal.code)).toBe(signal.severity);
    }
    expect(assessment.overall).toBe('high');
  });

  it('N5 flags only the driver threat, medium overall', () => {
    const assessment = assessRisk(bundleOf('N5').records);
    expect(assessment.signals).toHaveLength(1);
    expect(assessment.signals[0]).toMatchObject({ code: 'threat_in_chat', party: 'driver', severity: 'medium' });
    expect(assessment.overall).toBe('medium');
  });

  it('X6 flags the driver instruction-like chat text as high', () => {
    const assessment = assessRisk(bundleOf('X6').records);
    const flagged = assessment.signals.find(s => s.code === 'instruction_like_chat');
    expect(flagged?.party).toBe('driver');
    expect(flagged?.severity).toBe('high');
    expect(assessment.overall).toBe('high');
  });

  it('R2 flags the rider as a frequent filer', () => {
    const assessment = assessRisk(bundleOf('R2').records);
    const flagged = assessment.signals.find(s => s.code === 'frequent_filer');
    expect(flagged?.party).toBe('rider');
    expect(flagged?.severity).toBe('medium');
  });

  it('cites only evidence ids that exist in the bundle', () => {
    for (const fixture of ds.fixtures) {
      const bundle = bundleOf(fixture.fixtureId);
      const ids = new Set(bundle.records.map(r => r.id));
      for (const signal of assessRisk(bundle.records).signals)
        for (const id of signal.evidenceIds) expect(ids.has(id)).toBe(true);
    }
  });

  it('always carries the context-only caveat and deterministic source', () => {
    for (const fixture of ds.fixtures) {
      const assessment = assessRisk(bundleOf(fixture.fixtureId).records);
      expect(assessment.caveat).toBe(RISK_CAVEAT);
      expect(assessment.source).toBe('deterministic');
    }
  });

  it('flips each history signal exactly at its RISK_PARAMS boundary', () => {
    const p = RISK_PARAMS;
    expect(codesFor(historyRecord({ disputesFiled90d: p.frequentFilerDisputes90d - 1 }))).not.toContain('frequent_filer');
    expect(codesFor(historyRecord({ disputesFiled90d: p.frequentFilerDisputes90d }))).toContain('frequent_filer');

    expect(codesFor(historyRecord({ disputesAgainst90d: p.repeatSubjectMedium90d - 1 }))).not.toContain('repeat_subject');
    const medium = assessRisk([historyRecord({ disputesAgainst90d: p.repeatSubjectMedium90d })]).signals.find(s => s.code === 'repeat_subject');
    expect(medium?.severity).toBe('medium');
    const high = assessRisk([historyRecord({ disputesAgainst90d: p.repeatSubjectHigh90d })]).signals.find(s => s.code === 'repeat_subject');
    expect(high?.severity).toBe('high');

    expect(codesFor(historyRecord({ rating: p.lowRating }))).not.toContain('low_rating');
    expect(codesFor(historyRecord({ rating: p.lowRating - 0.1 }))).toContain('low_rating');

    expect(codesFor(historyRecord({ accountAgeDays: p.newAccountDays }))).not.toContain('new_account');
    expect(codesFor(historyRecord({ accountAgeDays: p.newAccountDays - 1 }))).toContain('new_account');
  });
});
