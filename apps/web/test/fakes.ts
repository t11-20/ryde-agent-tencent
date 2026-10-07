import type { ApiClient, CreateRunRequest } from "../src/api/client";
import type { ActivityEvent, FixtureListItem, RunView } from "../src/contracts/provisional";

export const FIXTURES: FixtureListItem[] = [
  { fixtureId: "R1", disputeId: "DSP-R1", category: "route_deviation", label: "Material detour", purpose: "golden", riderClaim: "claim R1", driverStatement: "stmt R1" },
  { fixtureId: "X1", disputeId: "DSP-X1", category: "route_deviation", label: "Missing GPS", purpose: "robustness", riderClaim: "claim X1", driverStatement: "stmt X1" },
];

export const ev = (runId: string, sequence: number, type = "tool_result", extra: Partial<ActivityEvent> = {}): ActivityEvent => ({
  runId, sequence, timestamp: new Date(Date.UTC(2026, 9, 7, 0, 0, sequence)).toISOString().replace(/\.\d{3}Z$/, "Z"),
  actor: "controller", type, summary: `${type} #${sequence}`, ...extra,
});

/** Scripted client: each getRun call returns the next view (the last one repeats). */
export class ScriptedClient implements ApiClient {
  readonly mode: "live" | "mock";
  createCalls: CreateRunRequest[] = [];
  getCalls: { runId: string; after: number }[] = [];
  private n = 0;
  constructor(private views: (runId: string) => (RunView | Error)[], mode: "live" | "mock" = "live", private readonly createDelayMs = 0) { this.mode = mode; }
  async listFixtures() { return FIXTURES; }
  async createRun(req: CreateRunRequest) {
    this.createCalls.push(req);
    if (this.createDelayMs) await new Promise((r) => setTimeout(r, this.createDelayMs));
    return { runId: `run-${this.createCalls.length}` };
  }
  async getRun(runId: string, after: number) {
    this.getCalls.push({ runId, after });
    const list = this.views(runId);
    const v = list[Math.min(this.n++, list.length - 1)];
    if (!v) throw new Error("no view");
    if (v instanceof Error) throw v;
    return v;
  }
}
