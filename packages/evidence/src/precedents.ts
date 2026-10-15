import { z } from 'zod';
import { PrecedentSchema } from '@fairtrip/contracts';
import type { Dispute, Precedent } from '@fairtrip/contracts';
import { readDataJson } from './data-dir.js';
import { FEATURE_OPPOSITES } from './features.js';

let cached: Precedent[] | undefined;

/** Load the seed precedent store (synthetic). Cached like loadDataset. */
export function loadPrecedentSeed(): Precedent[] {
  if (cached !== undefined) return cached;
  const store = z.array(PrecedentSchema).parse(readDataJson('precedents.json'));
  const ids = new Set<string>();
  for (const precedent of store) {
    if (ids.has(precedent.id)) throw new Error(`Dataset integrity: duplicate precedent id ${precedent.id}`);
    ids.add(precedent.id);
  }
  cached = store;
  return cached;
}

/** Same-category precedents ranked by shared feature count, then recency. Pure. */
export function matchPrecedents(
  store: readonly Precedent[],
  category: Dispute['category'],
  features: readonly string[],
  limit = 3,
): Precedent[] {
  const wanted = new Set(features);
  return store
    .filter(p => p.category === category)
    .filter(p => !p.features.some(f => { const opposite = FEATURE_OPPOSITES[f]; return opposite !== undefined && wanted.has(opposite); }))
    .map(p => ({ p, score: p.features.filter(f => wanted.has(f)).length }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.p.decidedAt.localeCompare(a.p.decidedAt))
    .slice(0, limit)
    .map(entry => entry.p);
}
