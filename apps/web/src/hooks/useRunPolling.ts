import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityEvent, Run } from '@fairtrip/contracts';
import { ContractMismatchError, fetchRun, startRun } from '../lib/api.js';
import { maxSequence, mergeEvents } from '../lib/events.js';

export type PollPhase = 'idle' | 'starting' | 'polling' | 'done' | 'stopped' | 'start_failed' | 'contract_mismatch' | 'connection_lost';
export interface PollState { phase: PollPhase; run: Run | null; events: ActivityEvent[]; problem: string | null }
const POLL_MS = 1000;
const MAX_NETWORK_ERRORS = 5;
const TERMINAL: ReadonlySet<string> = new Set(['completed', 'incomplete', 'failed']);

export function useRunPolling() {
  const [state, setState] = useState<PollState>({phase: 'idle', run: null, events: [], problem: null});
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef<string | null>(null);
  const events = useRef<ActivityEvent[]>([]);
  const networkErrors = useRef(0);
  const clearTimer = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };

  const pollOnce = useCallback(async (gen: number): Promise<void> => {
    const id = runId.current;
    if (id === null || gen !== generation.current) return;
    try {
      const run = await fetchRun(id, maxSequence(events.current));
      if (gen !== generation.current) return;
      networkErrors.current = 0;
      events.current = mergeEvents(events.current, run.events);
      const done = TERMINAL.has(run.status);
      setState({phase: done ? 'done' : 'polling', run, events: events.current, problem: null});
      if (!done) timer.current = setTimeout(() => { void pollOnce(gen); }, POLL_MS);
    } catch (error) {
      if (gen !== generation.current) return;
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof ContractMismatchError) { setState(s => ({...s, phase: 'contract_mismatch', problem: message})); return; }
      networkErrors.current += 1;
      if (networkErrors.current >= MAX_NETWORK_ERRORS) { setState(s => ({...s, phase: 'connection_lost', problem: message})); return; }
      timer.current = setTimeout(() => { void pollOnce(gen); }, POLL_MS);
    }
  }, []);

  const start = useCallback(async (fixtureId: string, riderClaim?: string): Promise<void> => {
    generation.current += 1;
    const gen = generation.current;
    clearTimer();
    runId.current = null; events.current = []; networkErrors.current = 0;
    setState({phase: 'starting', run: null, events: [], problem: null});
    try {
      const {id} = await startRun(riderClaim === undefined ? {fixtureId} : {fixtureId, riderClaim});
      if (gen !== generation.current) return;
      runId.current = id;
      setState(s => ({...s, phase: 'polling'}));
      void pollOnce(gen);
    } catch (error) {
      if (gen !== generation.current) return;
      setState({phase: 'start_failed', run: null, events: [], problem: error instanceof Error ? error.message : String(error)});
    }
  }, [pollOnce]);

  const keepWaiting = useCallback(() => {
    networkErrors.current = 0;
    setState(s => ({...s, phase: 'polling', problem: null}));
    void pollOnce(generation.current);
  }, [pollOnce]);
  const stop = useCallback(() => { generation.current += 1; clearTimer(); setState(s => ({...s, phase: 'stopped'})); }, []);
  useEffect(() => () => { generation.current += 1; clearTimer(); }, []);
  return {state, start, keepWaiting, stop};
}
