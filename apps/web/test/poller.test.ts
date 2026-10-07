import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractMismatchError, NetworkError } from "../src/api/client";
import type { RunStatus, RunView } from "../src/contracts/provisional";
import { MAX_CONSECUTIVE_NETWORK_ERRORS, startPolling } from "../src/state/poller";
import { ev, ScriptedClient } from "./fakes";

const view = (runId: string, status: RunStatus, seqs: number[]): RunView => ({ runId, status, events: seqs.map((s) => ev(runId, s)) });
const cbs = () => ({ onUpdate: vi.fn(), onContractMismatch: vi.fn(), onStalled: vi.fn() });

describe("startPolling", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it.each(["completed", "incomplete", "failed"] as RunStatus[])("stops on terminal status %s", async (terminal) => {
    const client = new ScriptedClient((id) => [view(id, "running", [1]), view(id, "running", [2]), view(id, terminal, [3])]);
    const cb = cbs();
    const p = startPolling(client, "run-1", cb, 1000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getCalls).toHaveLength(3);
    expect(client.getCalls.map((c) => c.after)).toEqual([0, 1, 2]);
    expect(cb.onUpdate).toHaveBeenCalledTimes(3);
    expect(cb.onUpdate.mock.lastCall?.[1].map((e: { sequence: number }) => e.sequence)).toEqual([1, 2, 3]);
    expect(p.stopped).toBe(true);
  });

  it("polls once per second", async () => {
    const client = new ScriptedClient((id) => [view(id, "running", [])]);
    const p = startPolling(client, "run-1", cbs(), 1000);
    await vi.advanceTimersByTimeAsync(3_050);
    expect(client.getCalls).toHaveLength(4); // t=0, 1s, 2s, 3s
    p.stop();
  });

  it("never calls back after stop() (run switch)", async () => {
    const client = new ScriptedClient((id) => [view(id, "running", [1])]);
    const cb = cbs();
    const p = startPolling(client, "run-1", cb, 1000);
    await vi.advanceTimersByTimeAsync(1_500);
    const calls = cb.onUpdate.mock.calls.length;
    p.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(cb.onUpdate.mock.calls.length).toBe(calls);
    expect(client.getCalls.length).toBe(2);
  });

  it("ignores events belonging to another run", async () => {
    const client = new ScriptedClient(() => [{ runId: "run-1", status: "completed", events: [ev("run-1", 1), ev("run-OLD", 2)] }]);
    const cb = cbs();
    startPolling(client, "run-1", cb, 1000);
    await vi.advanceTimersByTimeAsync(10);
    expect(cb.onUpdate.mock.lastCall?.[1]).toHaveLength(1);
  });

  it(`stalls after ${MAX_CONSECUTIVE_NETWORK_ERRORS} consecutive network errors and can resume`, async () => {
    const errs = Array.from({ length: MAX_CONSECUTIVE_NETWORK_ERRORS }, () => new NetworkError("down"));
    const client = new ScriptedClient((id) => [...errs, view(id, "completed", [1])]);
    const cb = cbs();
    const p = startPolling(client, "run-1", cb, 1000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(cb.onStalled).toHaveBeenCalledTimes(1);
    expect(client.getCalls).toHaveLength(MAX_CONSECUTIVE_NETWORK_ERRORS);
    p.resume();
    await vi.advanceTimersByTimeAsync(10);
    expect(cb.onUpdate).toHaveBeenCalledTimes(1);
    expect(p.stopped).toBe(true);
  });

  it("resets the error count after a success", async () => {
    const e = () => new NetworkError("blip");
    const client = new ScriptedClient((id) => [e(), e(), e(), e(), view(id, "running", []), e(), e(), e(), e(), view(id, "completed", [])]);
    const cb = cbs();
    startPolling(client, "run-1", cb, 1000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(cb.onStalled).not.toHaveBeenCalled();
  });

  it("reports a contract mismatch and stops", async () => {
    const client = new ScriptedClient(() => [new ContractMismatchError("GET /api/runs/:id", [])]);
    const cb = cbs();
    const p = startPolling(client, "run-1", cb, 1000);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(cb.onContractMismatch).toHaveBeenCalledTimes(1);
    expect(client.getCalls).toHaveLength(1);
    expect(p.stopped).toBe(true);
  });
});
