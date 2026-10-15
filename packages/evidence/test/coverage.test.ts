import { describe, expect, it } from 'vitest';
import type { RiskSignal } from '@fairtrip/contracts';
import {
  assessRisk,
  buildEvidence,
  caseFeatures,
  FEATURE_VOCABULARY,
  findExpected,
  loadDataset,
  loadPrecedentSeed,
  matchPrecedents,
  policyVerdict,
  type ExpectedOutcome,
  type Fixture,
} from '../src/index.js';

// Permanent dataset-comprehensiveness guard (SPEC §4.3 extension, 2026-10-13).
// Everything is computed from the data through the real pipeline: no golden
// numbers here, only coverage requirements over the computed results.

const RISK_CODES: RiskSignal['code'][] = [
  'frequent_filer',
  'repeat_subject',
  'low_rating',
  'new_account',
  'instruction_like_chat',
  'threat_in_chat',
];

const PARTIES = ['rider', 'driver'] as const;
const CATEGORIES = ['route_deviation', 'no_show'] as const;
const REMEDIES = ['keep_charge', 'refund_route_excess', 'refund_no_show_fee'] as const;
const PURPOSES = ['golden', 'variation', 'fairness', 'robustness'] as const;

const dataset = loadDataset();
const seeds = loadPrecedentSeed();

interface Row {
  fixture: Fixture;
  expected: ExpectedOutcome;
  risk: ReturnType<typeof assessRisk>;
  features: string[];
  precedentIds: string[];
}

const rows: Row[] = dataset.fixtures.map(fixture => {
  const bundle = buildEvidence(fixture, dataset.policy);
  const risk = assessRisk(bundle.records);
  const features = caseFeatures(bundle.records, fixture.dispute.category);
  const precedentIds = matchPrecedents(seeds, fixture.dispute.category, features).map(p => p.id);
  const expected = findExpected(dataset, fixture.fixtureId);
  if (expected === undefined) throw new Error(`no expected outcome for ${fixture.fixtureId}`);
  return { fixture, expected, risk, features, precedentIds };
});

describe('dataset coverage: risk signals', () => {
  it('every risk signal code fires in at least one fixture', () => {
    const fired = new Set(rows.flatMap(row => row.risk.signals.map(s => s.code)));
    for (const code of RISK_CODES) expect(fired.has(code), `no fixture fires ${code}`).toBe(true);
  });

  it.each(['instruction_like_chat', 'threat_in_chat'] as const)('%s fires for both parties', (code) => {
    for (const party of PARTIES) {
      const hit = rows.some(row => row.risk.signals.some(s => s.code === code && s.party === party));
      expect(hit, `no fixture fires ${code} for ${party}`).toBe(true);
    }
  });

  it.each(PARTIES)('at least one fixture is overall high on the %s side', (party) => {
    const hit = rows.some(
      row => row.risk.overall === 'high' && row.risk.signals.some(s => s.severity === 'high' && s.party === party),
    );
    expect(hit).toBe(true);
  });

  it.each(PARTIES)('a flagged %s can still win on the evidence', (party) => {
    const ruling = party === 'rider' ? 'rider_favored' : 'driver_favored';
    const hit = rows.some(
      row =>
        row.risk.overall === 'high' &&
        row.risk.signals.length > 0 &&
        row.risk.signals.every(s => s.party === party) &&
        row.expected.expectedRuling === ruling,
    );
    expect(hit).toBe(true);
  });

  it('at least one completed fixture is overall medium (must not escalate for risk)', () => {
    const hit = rows.some(row => row.risk.overall === 'medium' && row.expected.expectedStatus === 'completed');
    expect(hit).toBe(true);
  });
});

describe('dataset coverage: features and precedents', () => {
  it('every feature in FEATURE_VOCABULARY appears in at least one fixture', () => {
    const fired = new Set(rows.flatMap(row => row.features));
    for (const feature of FEATURE_VOCABULARY) expect(fired.has(feature), `no fixture emits ${feature}`).toBe(true);
  });

  it('every seed precedent is matched by at least one fixture', () => {
    const matched = new Set(rows.flatMap(row => row.precedentIds));
    for (const seed of seeds) expect(matched.has(seed.id), `no fixture matches ${seed.id}`).toBe(true);
  });
});

describe('dataset coverage: policy clauses, missing families, remedies and purposes', () => {
  it('every policy clause is a key clause of at least one expected outcome', () => {
    const keyed = new Set(rows.flatMap(row => row.expected.keyClauseIds));
    for (const clause of dataset.policy.clauses) {
      expect(keyed.has(clause.id), `no expected outcome keys ${clause.id}`).toBe(true);
    }
  });

  it.each(CATEGORIES)('%s has an incomplete fixture for gps and one for payment', (category) => {
    for (const family of ['gps', 'payment'] as const) {
      const hit = rows.some(
        row =>
          row.expected.category === category &&
          row.expected.expectedStatus === 'incomplete' &&
          row.expected.missingFamilies.length === 1 &&
          row.expected.missingFamilies.includes(family),
      );
      expect(hit, `no incomplete ${category} fixture missing ${family}`).toBe(true);
    }
  });

  it('every remedy id is the expected remedy of at least one fixture', () => {
    const expected = new Set(rows.map(row => row.expected.expectedRemedyId));
    for (const remedy of REMEDIES) expect(expected.has(remedy), `no fixture expects ${remedy}`).toBe(true);
  });

  it('every fixture purpose is used by at least one fixture', () => {
    const used = new Set(rows.map(row => row.fixture.purpose));
    for (const purpose of PURPOSES) expect(used.has(purpose), `no ${purpose} fixture`).toBe(true);
  });

  it('no fixture resolves to an undetermined policy verdict', () => {
    for (const row of rows) {
      const bundle = buildEvidence(row.fixture, dataset.policy);
      const verdict = policyVerdict(row.fixture.dispute.category, caseFeatures(bundle.records, row.fixture.dispute.category), bundle.unavailable);
      expect(verdict.outcome, `${row.fixture.fixtureId} verdict is undetermined`).not.toBe('undetermined');
      expect(verdict.outcome).toBe(row.expected.expectedStatus === 'incomplete' ? 'incomplete' : row.expected.expectedRemedyId);
    }
  });
});
