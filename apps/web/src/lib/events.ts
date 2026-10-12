import type { ActivityEvent } from '@fairtrip/contracts';

/** Merge poll batches: dedupe by sequence, sort ascending. */
export function mergeEvents(existing: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] {
  const bySequence = new Map<number, ActivityEvent>();
  for (const event of [...existing, ...incoming]) bySequence.set(event.sequence, event);
  return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
}

/** Highest sequence seen; 0 when empty. */
export function maxSequence(events: ActivityEvent[]): number {
  return events.reduce((max, event) => (event.sequence > max ? event.sequence : max), 0);
}

/** Seconds since the first event, to 1 decimal. */
export function elapsedSeconds(events: ActivityEvent[], event: ActivityEvent): number {
  const first = events[0] ?? event;
  const seconds = (Date.parse(event.timestamp) - Date.parse(first.timestamp)) / 1000;
  return Math.round(seconds * 10) / 10;
}
