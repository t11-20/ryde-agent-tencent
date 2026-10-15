import { describe, expect, it } from 'vitest';
import {
  buildEvidence,
  caseFeatures,
  FEATURE_VOCABULARY,
  findFixture,
  loadDataset,
  type Fixture,
} from '../src/index.js';

const ds = loadDataset();
const policy = ds.policy;

function fixtureOf(id: string): Fixture {
  const f = findFixture(ds, id);
  if (f === undefined) throw new Error(`${id} not found`);
  return f;
}

function featuresOf(id: string): string[] {
  const fixture = fixtureOf(id);
  return caseFeatures(buildEvidence(fixture, policy).records, fixture.dispute.category);
}

describe('caseFeatures', () => {
  it('R1 flags the exceeded threshold and the rider objection, not agreement', () => {
    const features = featuresOf('R1');
    expect(features).toContain('rd1_exceeded');
    expect(features).toContain('rider_objection');
    expect(features).not.toContain('rider_agreement');
  });

  it('R2 flags the exceeded threshold, agreement and the route request', () => {
    const features = featuresOf('R2');
    expect(features).toContain('rd1_exceeded');
    expect(features).toContain('rider_agreement');
    expect(features).toContain('rider_route_request');
  });

  it('R3 flags the documented reroute', () => {
    expect(featuresOf('R3')).toContain('documented_reroute');
  });

  it('N2 marks all three no-show conditions met', () => {
    const features = featuresOf('N2');
    expect(features).toContain('ns1_distance_met');
    expect(features).toContain('ns1_wait_met');
    expect(features).toContain('ns1_contact_met');
  });

  it('N3 marks the wait not met', () => {
    expect(featuresOf('N3')).toContain('ns1_wait_not_met');
  });

  it('N1 marks the distance not met', () => {
    expect(featuresOf('N1')).toContain('ns1_distance_not_met');
  });

  it('X1 emits no rd1 feature and does not throw when GPS is unavailable', () => {
    const features = featuresOf('X1');
    expect(features.some(f => f.startsWith('rd1_'))).toBe(false);
  });

  it('R4 marks the detour not exceeded with a rider objection', () => {
    const features = featuresOf('R4');
    expect(features).toContain('rd1_not_exceeded');
    expect(features).not.toContain('rd1_exceeded');
    expect(features).toContain('rider_objection');
  });

  it('N4 marks contact not met while distance and wait are met', () => {
    const features = featuresOf('N4');
    expect(features).toContain('ns1_contact_not_met');
    expect(features).toContain('ns1_distance_met');
    expect(features).toContain('ns1_wait_met');
  });

  it('N6 marks all three no-show conditions met at the minimum', () => {
    const features = featuresOf('N6');
    expect(features).toContain('ns1_distance_met');
    expect(features).toContain('ns1_wait_met');
    expect(features).toContain('ns1_contact_met');
  });

  it('X5 emits no pickup features and does not throw when GPS is unavailable', () => {
    const features = featuresOf('X5');
    expect(features.some(f => f.startsWith('ns1_distance') || f.startsWith('ns1_wait'))).toBe(false);
    expect(features).toContain('ns1_contact_met');
    expect(features).toContain('location_claim');
  });

  it('emits only vocabulary features for every fixture', () => {
    const vocabulary = new Set(FEATURE_VOCABULARY);
    for (const fixture of ds.fixtures) {
      const features = featuresOf(fixture.fixtureId);
      for (const feature of features) expect(vocabulary.has(feature)).toBe(true);
    }
  });
});
