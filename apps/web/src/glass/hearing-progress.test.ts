import { describe, expect, it } from 'vitest';
import { completedRun, event, sampleEvents } from '../lib/test-runs.js';
import { hearingProgress } from './hearing-progress.js';

describe('hearing progress', () => {
  it('starts at zero and advances monotonically through observed live milestones', () => {
    let previous = 0;
    for (let count = 0; count <= sampleEvents.length; count += 1) {
      const progress = hearingProgress({events: sampleEvents.slice(0, count), status: 'running'});
      if (count === 0) expect(progress.value).toBe(0);
      expect(progress.value).toBeGreaterThanOrEqual(previous);
      expect(progress.value).toBeLessThan(100);
      expect(progress.label).toBe('Review stages');
      previous = progress.value;
    }
    const run = completedRun();
    if (run.status !== 'completed') throw new Error('Expected completed run');
    expect(hearingProgress({events: run.events, status: run.status, result: run.result})).toMatchObject({value: 100, state: 'complete'});
  });

  it('does not advance for extra tools, retries, or repeated evidence events', () => {
    const events = sampleEvents.slice(0, 4);
    const before = hearingProgress({events, status: 'running'});
    const after = hearingProgress({events: [...events, event(5, 'rider', 'tool.requested'), event(6, 'rider', 'output.repair'), event(7, 'driver', 'evidence.retrieved')], status: 'running'});
    expect(after.value).toBe(before.value);
  });

  it('preserves progress while paused or disconnected', () => {
    const input = {events: sampleEvents.slice(0, 6), status: 'running' as const};
    const running = hearingProgress(input);
    expect(hearingProgress({...input, phase: 'stopped'})).toMatchObject({value: running.value, state: 'paused'});
    expect(hearingProgress({...input, phase: 'connection_lost'})).toMatchObject({value: running.value, state: 'attention'});
  });

  it('never describes interrupted or incomplete live work as complete', () => {
    for (const status of ['incomplete', 'failed'] as const) {
      const progress = hearingProgress({events: sampleEvents, status});
      expect(progress.value).toBeLessThan(100);
      expect(progress.state).toBe('attention');
    }
    expect(hearingProgress({events: sampleEvents, status: 'completed'}).value).toBeLessThan(100);
    const run = completedRun();
    if (run.status !== 'completed') throw new Error('Expected completed run');
    expect(hearingProgress({events: run.events, status: run.status, result: {...run.result, ruling: 'incomplete'}})).toMatchObject({state: 'attention'});
    expect(hearingProgress({events: run.events, status: run.status, result: {...run.result, ruling: 'incomplete'}}).value).toBeLessThan(100);
  });

  it('uses actual playback progress and clearly identifies unfinished decisions at playback completion', () => {
    expect(hearingProgress({events: [], status: 'running', progressMode: 'replay', replayProgress: 0})).toMatchObject({value: 0, label: 'Case review progress'});
    expect(hearingProgress({events: sampleEvents, status: 'running', progressMode: 'replay', replayProgress: 42})).toMatchObject({value: 42, state: 'running'});
    expect(hearingProgress({events: sampleEvents, status: 'incomplete', progressMode: 'replay', replayProgress: 100})).toMatchObject({value: 100, state: 'attention', description: 'Case review finished · More information needed'});
    expect(hearingProgress({events: sampleEvents, status: 'failed', progressMode: 'replay', replayProgress: 100})).toMatchObject({value: 100, state: 'attention', description: 'Case review finished · Hearing interrupted'});
  });

  it('keeps an escalated recommendation pending until a human decision exists', () => {
    const run = completedRun();
    if (run.status !== 'completed') throw new Error('Expected completed run');
    const input = {events: run.events, status: run.status, result: run.result};
    const pending = hearingProgress({...input, reviewPending: true});
    expect(pending.value).toBeLessThan(100);
    expect(pending).toMatchObject({state: 'attention', description: 'Human review needed · No final decision'});
    expect(hearingProgress({...input, reviewPending: false})).toMatchObject({value: 100, state: 'complete'});
    expect(hearingProgress({...input, reviewPending: true, progressMode: 'replay', replayProgress: 100})).toMatchObject({value: 100, state: 'attention', description: 'Case review finished · Human review needed'});
  });

  it('clamps malformed playback input and reserves playback completion for terminal runs', () => {
    for (const replayProgress of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -10]) {
      expect(hearingProgress({events: [], status: 'running', progressMode: 'replay', replayProgress}).value).toBe(0);
    }
    const unfinished = hearingProgress({events: sampleEvents, status: 'running', progressMode: 'replay', replayProgress: 200});
    expect(unfinished.value).toBeLessThan(100);
    const finished = hearingProgress({events: sampleEvents, status: 'incomplete', progressMode: 'replay', replayProgress: 200});
    expect(finished.value).toBe(100);
  });
});
