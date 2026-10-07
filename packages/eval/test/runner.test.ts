import { afterEach, describe, expect, it } from "vitest";
import { executeRun } from "../src/runner.js";
import { dataset } from "./helpers.js";
import { startFakeServer, type FakeServer } from "./fakeServer.js";

let srv: FakeServer | undefined;
afterEach(async () => { await srv?.close(); srv = undefined; });

describe("executeRun against the fake server", () => {
  it("polls with after=<highest sequence> and merges every event", async () => {
    srv = await startFakeServer(dataset, () => "perfect", 3);
    const r = await executeRun("R1", 1, { baseUrl: srv.url, timeoutMs: 5000, pollMs: 5 });
    expect(r.timedOut).toBe(false);
    expect(r.view?.status).toBe("completed");
    expect(r.view?.events.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const polls = srv.requests.filter((q) => q.startsWith("GET /api/runs/"));
    expect(polls.map((q) => q.split("after=")[1])).toEqual(["0", "3", "6", "9"]);
  });
  it("times out a slow run", async () => {
    srv = await startFakeServer(dataset, () => "slow");
    const r = await executeRun("R1", 1, { baseUrl: srv.url, timeoutMs: 150, pollMs: 10 });
    expect(r.timedOut).toBe(true);
    expect(r.error?.code).toBe("timeout");
    expect(r.latencyMs).toBeGreaterThanOrEqual(150);
  });
  it("records a network error when the API is down", async () => {
    const r = await executeRun("R1", 1, { baseUrl: "http://127.0.0.1:9", timeoutMs: 500, pollMs: 10, requestTimeoutMs: 300 });
    expect(r.error?.code).toBe("network_error");
    expect(r.view).toBeNull();
  });
  it("records a contract mismatch", async () => {
    const fetchImpl = (async (u: string | URL | Request) =>
      String(u).endsWith("/api/runs") ? new Response(JSON.stringify({ runId: "x" })) : new Response(JSON.stringify({ status: "weird" }))) as typeof fetch;
    const r = await executeRun("R1", 1, { baseUrl: "http://fake", timeoutMs: 500, pollMs: 10, fetchImpl });
    expect(r.error?.code).toBe("contract_mismatch");
  });
});
