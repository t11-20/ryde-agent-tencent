// DEV MOCK API client. Development only, off by default (VITE_API_MODE=mock enables it).
import { findFixture, listFixtures } from "@fairtrip/evidence";
import type { ApiClient, CreateRunRequest } from "../api/client";
import { NetworkError, parseOrMismatch } from "../api/client";
import { FixtureListSchema, RunViewSchema, type FixtureListItem, type RunView } from "../contracts/provisional";
import { mockDataset } from "./dataset";
import { buildScenario, DEV, viewAt, type ScenarioId, type Step } from "./scenarios";

interface MockRun { runId: string; startMs: number; steps: Step[]; dispute: RunView["dispute"] }

export interface MockCreateRunRequest extends CreateRunRequest { devScenario?: ScenarioId }

export class MockApiClient implements ApiClient {
  readonly mode = "mock" as const;
  private runs = new Map<string, MockRun>();
  private counter = 0;
  constructor(private readonly now: () => number = () => Date.now(), private readonly speed = 1) {}

  async listFixtures(): Promise<FixtureListItem[]> {
    return parseOrMismatch(FixtureListSchema, "GET /api/fixtures (mock)", listFixtures(mockDataset()));
  }

  async createRun(req: MockCreateRunRequest): Promise<{ runId: string }> {
    const ds = mockDataset();
    const fixture = findFixture(ds, req.fixtureId);
    if (!fixture) throw new NetworkError(`HTTP 404: unknown fixture ${req.fixtureId}`, 404);
    this.counter += 1;
    const runId = `mock-${fixture.fixtureId}-${this.counter}`;
    const steps = buildScenario(ds, fixture, req.devScenario) ?? [
      { atMs: 0, actor: "controller", type: "run_started", summary: `${DEV} Run started for ${fixture.dispute.id}.` },
      {
        atMs: 400, actor: "controller", type: "run_failed", summary: `${DEV} No scripted run exists for ${fixture.fixtureId}. Use live mode for real agent runs.`,
        apply: (s) => { s.view.status = "failed"; s.view.error = { code: "no_mock_script", message: `${DEV} No scripted run for ${fixture.fixtureId}.` }; },
      },
    ];
    const dispute = { ...fixture.dispute, riderClaim: req.riderClaim ?? fixture.dispute.riderClaim };
    this.runs.set(runId, { runId, startMs: this.now(), steps, dispute });
    return { runId };
  }

  async getRun(runId: string, after: number): Promise<RunView> {
    const run = this.runs.get(runId);
    if (!run) throw new NetworkError(`HTTP 404: unknown run ${runId}`, 404);
    const view = viewAt(runId, run.startMs, { dispute: run.dispute }, run.steps, (this.now() - run.startMs) * this.speed, after);
    // Mock output passes through the same contract as live responses.
    return parseOrMismatch(RunViewSchema, "GET /api/runs/:id (mock)", view);
  }
}
