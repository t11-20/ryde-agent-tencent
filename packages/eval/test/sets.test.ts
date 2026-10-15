import { describe, expect, it } from 'vitest';
import { loadDataset } from '@fairtrip/evidence';
import { planRuns } from '../src/sets.js';

const dataset = loadDataset();
const label = (plan: {fixtureId: string; attempt: number}[]) => plan.map(run => `${run.fixtureId}#${run.attempt}`);

describe('planRuns', () => {
  it('golden gives the eight golden fixtures once', () => {
    expect(planRuns('golden', 1, dataset)).toEqual(['R1', 'R2', 'R3', 'R4', 'N1', 'N2', 'N3', 'N4'].map(fixtureId => ({fixtureId, attempt: 1})));
  });

  it('all gives every fixture in canonical order', () => {
    expect(planRuns('all', 1, dataset).map(run => run.fixtureId)).toEqual(dataset.expected.map(outcome => outcome.fixtureId));
  });

  it('release gives 26 runs with R1, N2 and R1F three consecutive times', () => {
    const plan = label(planRuns('release', 1, dataset));
    expect(plan).toHaveLength(26);
    for (const id of ['R1', 'N2', 'R1F']) {
      const first = plan.indexOf(`${id}#1`);
      expect(plan.slice(first, first + 3)).toEqual([`${id}#1`, `${id}#2`, `${id}#3`]);
    }
  });

  it('a comma list with repeat repeats each fixture in a row', () => {
    expect(label(planRuns('R1,N2', 2, dataset))).toEqual(['R1#1', 'R1#2', 'N2#1', 'N2#2']);
  });

  it('an unknown fixture throws', () => {
    expect(() => planRuns('R1,ZZ9', 1, dataset)).toThrow('Unknown fixture: ZZ9');
  });
});
