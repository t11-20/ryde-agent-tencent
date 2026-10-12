import { describe, expect, it } from 'vitest';
import { elapsedSeconds, maxSequence, mergeEvents } from './events.js';
import { event, sampleEvents } from './test-runs.js';

describe('mergeEvents', () => {
  it('deduplicates by sequence', () => {
    const merged = mergeEvents(sampleEvents, sampleEvents.slice(0, 3));
    expect(merged).toHaveLength(sampleEvents.length);
    expect(merged).toEqual(sampleEvents);
  });
  it('sorts out-of-order batches ascending', () => {
    const merged = mergeEvents([event(5, 'rider', 'case.completed')], [event(3, 'rider', 'evidence.retrieved'), event(9, 'system', 'run.completed')]);
    expect(merged.map(e => e.sequence)).toEqual([3, 5, 9]);
  });
});

describe('maxSequence', () => {
  it('is 0 when empty', () => { expect(maxSequence([])).toBe(0); });
  it('finds the highest sequence', () => { expect(maxSequence(sampleEvents)).toBe(9); });
});

describe('elapsedSeconds', () => {
  it('measures seconds since the first event', () => {
    const last = sampleEvents[8];
    if (last === undefined) throw new Error('missing event 9');
    expect(elapsedSeconds(sampleEvents, last)).toBe(8);
  });
});
