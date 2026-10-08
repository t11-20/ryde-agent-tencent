import { describe, it, expect, vi } from 'vitest';
import { runWorkflow } from '@fairtrip/agents';
import { catalog } from '../apps/api/src/catalog.js';
import type { AdvocateCase, Dispute } from '@fairtrip/contracts';
const signal = () => new AbortController().signal;
const judge = () => vi.fn(async (_cases: AdvocateCase[], _dispute: Dispute, _signal: AbortSignal) => catalog.judgeResult);
describe('fixed workflow foundation', () => {
  it('starts both advocates before either completes, and invokes Judge after validation', async () => {
    const started: string[] = [];
    let release!: () => void;
    const barrier = new Promise<void>(resolve => {release = resolve;});
    const adjudicate = judge();
    const pending = runWorkflow(catalog.disputes[0]!, {
      async advocate(side) {started.push(side); if (started.length === 2) release(); await barrier; return side === 'rider' ? catalog.riderCase : catalog.driverCase;},
      judge: adjudicate
    }, catalog.evidence, catalog.policies, signal());
    expect(started).toEqual(['rider', 'driver']);
    expect(adjudicate).not.toHaveBeenCalled();
    await pending;
    expect(adjudicate).toHaveBeenCalledOnce();
    expect(adjudicate.mock.calls[0]![0]).toHaveLength(2);
  });
  it.each(['malformed', 'wrong_side', 'bad_citation'])('does not call Judge for %s advocate output', async failure => {
    const adjudicate = judge();
    const invalid = structuredClone(catalog.riderCase);
    if (failure === 'wrong_side') invalid.side = 'driver';
    if (failure === 'bad_citation') invalid.arguments[0]!.evidenceIds = ['invented'];
    await expect(runWorkflow(catalog.disputes[0]!, {
      async advocate(side) {return side === 'driver' ? catalog.driverCase : failure === 'malformed' ? {} : invalid;}, judge: adjudicate
    }, catalog.evidence, catalog.policies, signal())).rejects.toThrow();
    expect(adjudicate).not.toHaveBeenCalled();
  });
  it('honors cancellation before starting any role', async () => {
    const controller = new AbortController(); controller.abort();
    const advocate = vi.fn(), adjudicate = judge();
    await expect(runWorkflow(catalog.disputes[0]!, {advocate, judge: adjudicate}, catalog.evidence, catalog.policies, controller.signal)).rejects.toThrow();
    expect(advocate).not.toHaveBeenCalled(); expect(adjudicate).not.toHaveBeenCalled();
  });
  it('emits events through the WorkflowEventEmitter', async () => {
    const events: {actor: string; type: string}[] = [];
    const emitter = {emit: (e: {actor: string; type: string}) => events.push(e)};
    await runWorkflow(catalog.disputes[0]!, {
      async advocate(side) { return side === 'rider' ? catalog.riderCase : catalog.driverCase; },
      judge: judge()
    }, catalog.evidence, catalog.policies, signal(), emitter);
    expect(events.some(e => e.type === 'model.start' && e.actor === 'rider')).toBe(true);
    expect(events.some(e => e.type === 'model.start' && e.actor === 'driver')).toBe(true);
    expect(events.some(e => e.type === 'case.completed' && e.actor === 'rider')).toBe(true);
    expect(events.some(e => e.type === 'case.completed' && e.actor === 'driver')).toBe(true);
    expect(events.some(e => e.type === 'judge.started' && e.actor === 'judge')).toBe(true);
    expect(events.some(e => e.type === 'model.start' && e.actor === 'judge')).toBe(true);
    expect(events.some(e => e.type === 'model.finish' && e.actor === 'judge')).toBe(true);
  });
});
