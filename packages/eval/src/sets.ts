import type { Dataset } from '@fairtrip/evidence';

export interface PlannedRun { fixtureId: string; attempt: number }

export const GOLDEN_FIXTURES = ['R1', 'R2', 'R3', 'N1', 'N2', 'N3'] as const;
export const RELEASE_TRIPLE_FIXTURES = ['R1', 'N2'] as const;

function baseList(spec: string, dataset: Dataset): string[] {
  const all = dataset.expected.map(outcome => outcome.fixtureId);
  if (spec === 'golden') return [...GOLDEN_FIXTURES];
  if (spec === 'all') return all;
  if (spec === 'release') {
    const triple = new Set<string>(RELEASE_TRIPLE_FIXTURES);
    return all.flatMap(id => (triple.has(id) ? [id, id, id] : [id]));
  }
  const ids = spec.split(',').map(id => id.trim()).filter(id => id.length > 0);
  if (ids.length === 0) throw new Error(`Unknown fixture: ${spec}`);
  for (const id of ids) if (!all.includes(id)) throw new Error(`Unknown fixture: ${id}`);
  return ids;
}

export function planRuns(spec: string, repeat: number, dataset: Dataset): PlannedRun[] {
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error(`Invalid repeat: ${repeat}`);
  const attempts = new Map<string, number>();
  const plan: PlannedRun[] = [];
  for (const fixtureId of baseList(spec, dataset)) {
    for (let i = 0; i < repeat; i++) {
      const attempt = (attempts.get(fixtureId) ?? 0) + 1;
      attempts.set(fixtureId, attempt);
      plan.push({fixtureId, attempt});
    }
  }
  return plan;
}
