import { describe, expect, it } from 'vitest';
import type { Dispute } from '@fairtrip/contracts';
import { createFixtureSource, findFixture, loadDataset } from '../src/index.js';

const ds = loadDataset();
const source = createFixtureSource(ds);

function disputeOf(id: string): Dispute {
  const fixture = findFixture(ds, id);
  if (fixture === undefined) throw new Error(`${id} not found`);
  return fixture.dispute;
}

describe('createFixtureSource — stretch goal accessors', () => {
  it('riskAssessment flags the high-risk history fixture', () => {
    expect(source.riskAssessment(disputeOf('N2H')).overall).toBe('high');
  });

  it('caseFeatures derives the exceeded-threshold feature', () => {
    expect(source.caseFeatures(disputeOf('R1'))).toContain('rd1_exceeded');
  });

  it('precedentSeed returns the seed store', () => {
    expect(source.precedentSeed()).toHaveLength(8);
  });

  it('similarPrecedents ranks the strongest seed match first', () => {
    const matches = source.similarPrecedents(disputeOf('R1'), source.precedentSeed());
    expect(matches[0]?.id).toBe('PREC-001');
  });

  it('returned values are safe to mutate', () => {
    const first = source.precedentSeed();
    first.splice(0, first.length);
    expect(source.precedentSeed()).toHaveLength(8);
    const features = source.caseFeatures(disputeOf('R1'));
    features.length = 0;
    expect(source.caseFeatures(disputeOf('R1'))).toContain('rd1_exceeded');
  });
});
