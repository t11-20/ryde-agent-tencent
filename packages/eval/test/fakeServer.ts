// In-process FAKE API for testing the eval runner. Not Lane A's server; never used for real scores.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createDisputeTools, findExpected, findFixture, type Dataset, type EvidenceFamily } from "@fairtrip/evidence";
import type { RunView } from "../src/contracts.js";

export type Behaviour =
  | "perfect"
  | "wrong_amount"
  | "unknown_citation"
  | "missing_handoff"
  | "think_leak"
  | "incomplete_with_amount"
  | "slow";

type Ev = RunView["events"][number];

/** A complete, correct run view for a fixture, then mutated per behaviour. */
export function scriptedView(dataset: Dataset, fixtureId: string, runId: string, behaviour: Behaviour): RunView {
  const f = findFixture(dataset, fixtureId);
  const exp = findExpected(dataset, fixtureId);
  if (!f || !exp) throw new Error(`fake server: unknown fixture ${fixtureId}`);
  const tools = createDisputeTools(dataset, f.dispute.id);
  const all: EvidenceFamily[] = ["gps", "chat", "payment", "history"];
  const got = tools.get_evidence({ sources: all });
  if (!got.ok) throw new Error("fake server: get_evidence failed");
  const ids = got.data.records.map((r) => r.id);
  let seq = 0;
  const ev = (actor: string, type: string, summary: string, refs?: Ev["refs"]): Ev => ({
    runId, sequence: ++seq, timestamp: new Date(Date.UTC(2026, 9, 7, 0, 0, seq)).toISOString(), actor, type, summary, ...(refs ? { refs } : {}),
  });
  const decisive = exp.decisiveEvidenceIds.length ? exp.decisiveEvidenceIds : ids.slice(0, 1);
  const point = (p: string, evidenceIds: string[], policyIds: string[]) => ({ point: p, evidenceIds, policyIds });
  const events: Ev[] = [
    ev("controller", "run_started", "Run started"),
    ev("rider_advocate", "tool_requested", "get_evidence(gps, chat, payment, history)"),
    ev("rider_advocate", "tool_result", `${ids.length} records`, { evidenceIds: ids }),
    ev("driver_advocate", "tool_requested", "get_evidence(gps, chat, payment, history)"),
    ev("driver_advocate", "tool_result", `${ids.length} records`, { evidenceIds: ids }),
    ev("rider_advocate", "case_submitted", "Rider case"),
    ev("driver_advocate", "case_submitted", "Driver case"),
    ev("controller", "handoff_to_judge", "Handoff to Judge"),
    ev("judge", "ruling_issued", "Ruling issued"),
    ev("controller", exp.status === "resolved" ? "run_completed" : "run_incomplete", "Run finished"),
  ];
  const view: RunView = {
    runId,
    status: exp.status === "resolved" ? "completed" : "incomplete",
    events,
    evidence: got.data.records.map((r) => ({ id: r.id, family: r.family })),
    cases: {
      rider: { arguments: [point("rider point", decisive, exp.clauseIds)], counterevidence: [] },
      driver: { arguments: [point("driver point", ids.slice(-1), ["GEN-2"])], counterevidence: [] },
    },
    ...(exp.status === "incomplete" ? { missingEvidence: exp.missingFamilies.map((family) => ({ family, reason: "unavailable" })) } : {}),
    usage: { modelCalls: 5, inputTokens: 1000, outputTokens: 200 },
  };
  if (exp.status === "resolved" && exp.remedyId !== null && exp.amountCents !== null) {
    view.result = {
      judge: { findings: [point("finding", decisive, exp.clauseIds)], remedyId: exp.remedyId },
      action: { remedyId: exp.remedyId, amountCents: exp.amountCents, recipient: exp.amountCents > 0 ? "rider" : null },
    };
  }

  switch (behaviour) {
    case "perfect":
    case "slow":
      break;
    case "wrong_amount":
      if (view.result?.action) view.result.action.amountCents = (view.result.action.amountCents ?? 0) + 1;
      break;
    case "unknown_citation":
      if (view.result) view.result.judge.findings.push(point("bogus", ["GPS-ROUTE-99"], ["RD-99"]));
      break;
    case "missing_handoff":
      view.events = view.events.filter((e) => e.type !== "handoff_to_judge");
      break;
    case "think_leak":
      view.events[8] = { ...(view.events[8] as Ev), summary: "<think>the rider seems honest</think> Ruling issued" };
      (view as Record<string, unknown>).debug = { reasoning_content: "hidden thoughts" };
      break;
    case "incomplete_with_amount":
      view.status = "incomplete";
      view.result = {
        judge: { findings: [point("finding", decisive, ["GEN-1"])], remedyId: "refund_no_show_fee" },
        action: { remedyId: "refund_no_show_fee", amountCents: 500, recipient: "rider" },
      };
      break;
  }
  if (behaviour === "slow") {
    view.status = "running";
    view.events = view.events.slice(0, 3);
  }
  return view;
}

export interface FakeServer { url: string; close(): Promise<void>; requests: string[] }

/**
 * Serves GET /api/fixtures, POST /api/runs and GET /api/runs/:id?after=.
 * `behaviourFor(fixtureId, attempt)` picks the script; events are released `eventsPerPoll` at a time.
 */
export async function startFakeServer(dataset: Dataset, behaviourFor: (fixtureId: string, attempt: number) => Behaviour = () => "perfect", eventsPerPoll = 4): Promise<FakeServer> {
  const runs = new Map<string, { view: RunView; polls: number }>();
  const attempts = new Map<string, number>();
  const requests: string[] = [];
  let n = 0;
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://fake");
    requests.push(`${req.method} ${url.pathname}${url.search}`);
    const send = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (req.method === "GET" && url.pathname === "/api/fixtures") return send(200, dataset.fixtures.map((f) => ({ fixtureId: f.fixtureId })));
    if (req.method === "POST" && url.pathname === "/api/runs") {
      let body = "";
      req.on("data", (c: Buffer) => { body += c.toString(); });
      req.on("end", () => {
        const { fixtureId } = JSON.parse(body) as { fixtureId: string };
        const attempt = (attempts.get(fixtureId) ?? 0) + 1;
        attempts.set(fixtureId, attempt);
        const runId = `fake-${++n}`;
        runs.set(runId, { view: scriptedView(dataset, fixtureId, runId, behaviourFor(fixtureId, attempt)), polls: 0 });
        send(201, { runId });
      });
      return;
    }
    const m = /^\/api\/runs\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && m) {
      const run = runs.get(decodeURIComponent(m[1] as string));
      if (!run) return send(404, { error: "not found" });
      run.polls += 1;
      const after = Number(url.searchParams.get("after") ?? "0");
      const visible = run.view.events.slice(0, run.polls * eventsPerPoll);
      const finished = visible.length === run.view.events.length;
      const status = finished ? run.view.status : "running";
      const partial = finished ? run.view : { runId: run.view.runId, status, events: [] };
      return send(200, { ...partial, status, events: visible.filter((e) => e.sequence > after) });
    }
    send(404, { error: "not found" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}
