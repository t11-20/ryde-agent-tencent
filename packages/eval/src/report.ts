export interface CheckResult { ok: boolean; detail: string }
export interface RunChecks { statusMatch: CheckResult; remedyMatch: CheckResult; amountExact: CheckResult; citationsValid: CheckResult; traceComplete: CheckResult; noReasoningLeak: CheckResult; withinDeadline: CheckResult }
export interface RunResult {
  fixtureId: string; attempt: number; runId: string | null; status: string; remedyId: string | null; amountCents: number | null;
  latencyMs: number; passed: boolean; checks: RunChecks; decisiveCoverage: number | null; problem: string | null;
}
export interface GateCondition { name: string; ok: boolean; detail: string }
export interface GateResult { passed: boolean; conditions: GateCondition[] }
export interface Metrics {
  runs: number; runsPassed: number; fixturesRun: number; fixturesPassed: number; exactMoney: number; citationValid: number;
  traceComplete: number; consistentFixtures: number; repeatedFixtures: number; p50LatencySec: number | null; maxLatencySec: number | null;
}
export interface EvalReport { startedAt: string; baseUrl: string; outDir: string; runs: RunResult[]; metrics: Metrics; gate: GateResult | null }
