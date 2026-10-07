import type { ActivityEvent } from "../contracts/provisional";

/** Merge a batch into the known events: dedupe by sequence (first copy wins), sorted ascending. */
export function mergeEvents(existing: readonly ActivityEvent[], batch: readonly ActivityEvent[]): ActivityEvent[] {
  const bySeq = new Map<number, ActivityEvent>();
  for (const e of existing) if (!bySeq.has(e.sequence)) bySeq.set(e.sequence, e);
  for (const e of batch) if (!bySeq.has(e.sequence)) bySeq.set(e.sequence, e);
  return [...bySeq.values()].sort((a, b) => a.sequence - b.sequence);
}

export const maxSequence = (events: readonly ActivityEvent[]): number =>
  events.reduce((m, e) => (e.sequence > m ? e.sequence : m), 0);
