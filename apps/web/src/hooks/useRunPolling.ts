import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityEvent, Run } from '@fairtrip/contracts';
import { ContractMismatchError, NetworkError, fetchRun, nextRunId, startRun } from '../lib/api.js';
import { maxSequence, mergeEvents } from '../lib/events.js';

export type PollPhase = 'idle' | 'starting' | 'polling' | 'done' | 'stopped' | 'start_failed' | 'contract_mismatch' | 'connection_lost';
export interface PollState {
  phase: PollPhase; run: Run | null; events: ActivityEvent[]; problem: string | null;
  /** Set when the API retried a first-attempt failure: the first attempt's id and error message. */
  retriedFrom: string | null;
  retriedMessage: string | null;
}
const POLL_MS = 1000;
const MAX_NETWORK_ERRORS = 5;
const TERMINAL: ReadonlySet<string> = new Set(['completed', 'incomplete', 'failed']);

export function useRunPolling() {
  const [state, setState] = useState<PollState>({phase: 'idle', run: null, events: [], problem: null, retriedFrom: null, retriedMessage: null});
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef<string | null>(null);
  const events = useRef<ActivityEvent[]>([]);
  const networkErrors = useRef(0);
  const retriedFrom = useRef<string | null>(null);
  const retriedMessage = useRef<string | null>(null);
  const clearTimer = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };

  const pollOnce = useCallback(async (gen: number): Promise<void> => {
    const id = runId.current;
    if (id === null || gen !== generation.current) return;
    try {
      const run = await fetchRun(id, maxSequence(events.current));
      if (gen !== generation.current) return;
      networkErrors.current = 0;
      const done = TERMINAL.has(run.status);
      // A first-attempt failure produces one automatic re-run; follow retriedBy and
      // keep polling the new run instead of settling on the failed attempt.
      const retryId = run.status === 'failed' && retriedFrom.current === null ? nextRunId(run) : null;
      if (done && retryId !== null) {
        retriedFrom.current = run.id;
        retriedMessage.current = run.status === 'failed' ? run.error.message : 'workflow failure';
        runId.current = retryId;
        events.current = [];
        setState(s => ({...s, phase: 'polling', run, retriedFrom: run.id, retriedMessage: retriedMessage.current}));
        timer.current = setTimeout(() => { void pollOnce(gen); }, POLL_MS);
        return;
      }
      events.current = mergeEvents(events.current, run.events);
      setState({phase: done ? 'done' : 'polling', run, events: events.current, problem: null, retriedFrom: retriedFrom.current, retriedMessage: retriedMessage.current});
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
    retriedFrom.current = null; retriedMessage.current = null;
    setState({phase: 'starting', run: null, events: [], problem: null, retriedFrom: null, retriedMessage: null});
    try {
      const {id} = await startRun(riderClaim === undefined ? {fixtureId} : {fixtureId, riderClaim});
      if (gen !== generation.current) return;
      runId.current = id;
      setState(s => ({...s, phase: 'polling'}));
      void pollOnce(gen);
    } catch (error) {
      if (gen !== generation.current) return;
      setState({phase: 'start_failed', run: null, events: [], problem: error instanceof Error ? error.message : String(error), retriedFrom: null, retriedMessage: null});
    }
  }, [pollOnce]);

  // Resume polling an existing run id (deep link / recent-runs list). Resolves
  // false only when the server does not know the run (404); transient errors
  // fall back into the normal poll-retry loop.
  const resume = useCallback(async (id: string): Promise<boolean> => {
    generation.current += 1;
    const gen = generation.current;
    clearTimer();
    runId.current = id; events.current = []; networkErrors.current = 0;
    retriedFrom.current = null; retriedMessage.current = null;
    setState({phase: 'polling', run: null, events: [], problem: null, retriedFrom: null, retriedMessage: null});
    try {
      const run = await fetchRun(id, 0);
      if (gen !== generation.current) return false;
      events.current = mergeEvents(events.current, run.events);
      const done = TERMINAL.has(run.status);
      setState({phase: done ? 'done' : 'polling', run, events: events.current, problem: null, retriedFrom: null, retriedMessage: null});
      if (!done) timer.current = setTimeout(() => { void pollOnce(gen); }, POLL_MS);
      return true;
    } catch (error) {
      if (gen !== generation.current) return false;
      if (error instanceof NetworkError && error.status === 404) {
        setState({phase: 'idle', run: null, events: [], problem: null, retriedFrom: null, retriedMessage: null});
        return false;
      }
      if (error instanceof ContractMismatchError) {
        setState(s => ({...s, phase: 'contract_mismatch', problem: error.message}));
        return true;
      }
      networkErrors.current += 1;
      setState(s => ({...s, phase: 'polling', problem: error instanceof Error ? error.message : String(error)}));
      timer.current = setTimeout(() => { void pollOnce(gen); }, POLL_MS);
      return true;
    }
  }, [pollOnce]);

  const keepWaiting = useCallback(() => {
    networkErrors.current = 0;
    setState(s => ({...s, phase: 'polling', problem: null}));
    void pollOnce(generation.current);
  }, [pollOnce]);
  const stop = useCallback(() => { generation.current += 1; clearTimer(); setState(s => ({...s, phase: 'stopped'})); }, []);
  // Replace the stored run wholesale (e.g. after a human review) without touching the phase.
  const replaceRun = useCallback((run: Run) => {
    events.current = mergeEvents(events.current, run.events);
    setState(s => ({...s, run, events: events.current}));
  }, []);
  useEffect(() => () => { generation.current += 1; clearTimer(); }, []);
  return {state, start, resume, keepWaiting, stop, replaceRun};
}
