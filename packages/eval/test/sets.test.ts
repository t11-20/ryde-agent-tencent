import { describe, expect, it } from 'vitest';
import { loadDataset } from '@fairtrip/evidence';
import { planRuns } from '../src/sets.js';

const dataset = loadDataset();
const label = (plan: {fixtureId: string; attempt: number}[]) => plan.map(run => `${run.fixtureId}#${run.attempt}`);

describe('planRuns', () => {
  it('golden gives the six golden fixtures once', () => {
    expect(planRuns('golden', 1, dataset)).toEqual(['R1', 'R2', 'R3', 'N1', 'N2', 'N3'].map(fixtureId => ({fixtureId, attempt: 1})));
  });

  it('all gives every fixture in canonical order', () => {
    expect(planRuns('all', 1, dataset).map(run => run.fixtureId)).toEqual(dataset.expected.map(outcome => outcome.fixtureId));
  });

  it('release gives 15 runs with R1 and N2 three consecutive times', () => {
    const plan = label(planRuns('release', 1, dataset));
    expect(plan).toHaveLength(15);
    const r1 = plan.indexOf('R1#1');
    expect(plan.slice(r1, r1 + 3)).toEqual(['R1#1', 'R1#2', 'R1#3']);
    const n2 = plan.indexOf('N2#1');
    expect(plan.slice(n2, n2 + 3)).toEqual(['N2#1', 'N2#2', 'N2#3']);
  });

  it('a comma list with repeat repeats each fixture in a row', () => {
    expect(label(planRuns('R1,N2', 2, dataset))).toEqual(['R1#1', 'R1#2', 'N2#1', 'N2#2']);
  });

  it('an unknown fixture throws', () => {
    expect(() => planRuns('R1,ZZ9', 1, dataset)).toThrow('Unknown fixture: ZZ9');
  });
});
