import { useCallback, useEffect, useReducer, useRef } from "react";
import { ContractMismatchError, type ApiClient, type CreateRunRequest } from "../api/client";
import type { ActivityEvent, RunStatus, RunView } from "../contracts/provisional";
import { startPolling, type Poller } from "./poller";

export type UiStatus = "idle" | "submitting" | RunStatus | "contract_mismatch";

export interface RunState {
  status: UiStatus;
  runId?: string;
  fixtureId?: string;
  view?: RunView;
  events: ActivityEvent[];
  startedAtMs?: number;
  error?: { code: string; message: string };
  mismatch?: { endpoint: string; issues: unknown };
  /** Polling paused after 5 consecutive network errors. */
  stalled: boolean;
}

type Action =
  | { type: "submit"; fixtureId: string; at: number }
  | { type: "created"; runId: string }
  | { type: "update"; runId: string; view: RunView; events: ActivityEvent[] }
  | { type: "mismatch"; runId?: string; endpoint: string; issues: unknown }
  | { type: "submit_failed"; message: string }
  | { type: "stalled"; runId: string; message: string }
  | { type: "resumed"; runId: string }
  | { type: "stopped"; runId: string };

const initial: RunState = { status: "idle", events: [], stalled: false };

export function runReducer(s: RunState, a: Action): RunState {
  switch (a.type) {
    case "submit":
      return { status: "submitting", fixtureId: a.fixtureId, events: [], startedAtMs: a.at, stalled: false };
    case "created":
      return { ...s, runId: a.runId, status: "queued" };
    case "update":
      if (a.runId !== s.runId) return s; // never show a stale run's data
      return { ...s, view: a.view, events: a.events, status: a.view.status, error: a.view.error ?? s.error, stalled: false };
    case "mismatch":
      if (a.runId && a.runId !== s.runId) return s;
      return { ...s, status: "contract_mismatch", mismatch: { endpoint: a.endpoint, issues: a.issues }, stalled: false };
    case "submit_failed":
      return { ...s, status: "failed", error: { code: "submit_failed", message: a.message } };
    case "stalled":
      if (a.runId !== s.runId) return s;
      return { ...s, stalled: true, error: { code: "network_unreachable", message: a.message } };
    case "resumed":
      if (a.runId !== s.runId) return s;
      return { ...s, stalled: false, error: undefined };
    case "stopped":
      if (a.runId !== s.runId) return s;
      return { ...s, stalled: false, status: "failed", error: { code: "polling_stopped", message: "Polling stopped by the operator after repeated network errors. The run's final state is unknown." } };
  }
}

export const isActive = (s: RunState): boolean => s.status === "submitting" || s.status === "queued" || s.status === "running";

export interface RunControls {
  state: RunState;
  start(req: CreateRunRequest & Record<string, unknown>): void;
  keepWaiting(): void;
  stopWaiting(): void;
}

export function useRun(client: ApiClient, pollIntervalMs?: number): RunControls {
  const [state, dispatch] = useReducer(runReducer, initial);
  const poller = useRef<Poller | null>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const runIdRef = useRef<string | undefined>(undefined);

  useEffect(() => () => { poller.current?.stop(); generation.current += 1; }, []);

  const start = useCallback((req: CreateRunRequest & Record<string, unknown>) => {
    if (active.current) return; // exactly one active run; ignores double clicks
    active.current = true;
    poller.current?.stop();
    const gen = ++generation.current;
    dispatch({ type: "submit", fixtureId: req.fixtureId, at: Date.now() });
    client.createRun(req).then(
      ({ runId }) => {
        if (gen !== generation.current) return;
        runIdRef.current = runId;
        dispatch({ type: "created", runId });
        poller.current = startPolling(client, runId, {
          onUpdate: (view, events) => {
            if (gen !== generation.current) return;
            dispatch({ type: "update", runId, view, events });
            if (view.status === "completed" || view.status === "incomplete" || view.status === "failed") active.current = false;
          },
          onContractMismatch: (e) => {
            if (gen !== generation.current) return;
            active.current = false;
            dispatch({ type: "mismatch", runId, endpoint: e.endpoint, issues: e.issues });
          },
          onStalled: (e) => {
            if (gen !== generation.current) return;
            dispatch({ type: "stalled", runId, message: e instanceof Error ? e.message : String(e) });
          },
        }, pollIntervalMs);
      },
      (e: unknown) => {
        if (gen !== generation.current) return;
        active.current = false;
        if (e instanceof ContractMismatchError) dispatch({ type: "mismatch", endpoint: e.endpoint, issues: e.issues });
        else dispatch({ type: "submit_failed", message: e instanceof Error ? e.message : String(e) });
      },
    );
  }, [client, pollIntervalMs]);

  const keepWaiting = useCallback(() => {
    if (!runIdRef.current) return;
    dispatch({ type: "resumed", runId: runIdRef.current });
    poller.current?.resume();
  }, []);

  const stopWaiting = useCallback(() => {
    if (!runIdRef.current) return;
    poller.current?.stop();
    active.current = false;
    dispatch({ type: "stopped", runId: runIdRef.current });
  }, []);

  return { state, start, keepWaiting, stopWaiting };
}
