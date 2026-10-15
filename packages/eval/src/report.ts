import type { RiskSeverity } from '@fairtrip/contracts';

export interface CheckResult { ok: boolean; detail: string }
export interface RunChecks { statusMatch: CheckResult; remedyMatch: CheckResult; amountExact: CheckResult; citationsValid: CheckResult; traceComplete: CheckResult; noReasoningLeak: CheckResult; withinDeadline: CheckResult; riskSignalsIntact: CheckResult; contextOnly: CheckResult; verdictMatch: CheckResult }
export type FailureClass = 'provider_timeout' | 'provider_network' | 'run_deadline' | 'model_output' | 'outcome_mismatch' | 'check_failure';
export type AgentRole = 'rider' | 'driver' | 'risk' | 'judge';
/** Per-call model spans in seconds plus recovery counters, over one run's events. */
export interface RunModelStats {
  callSec: {toolRequest: number[]; case: number[]; judge: number[]; risk: number[]};
  directedRepairs: number;
  normalisations: number;
  callRetries: number;
  hedgesFired: number;
  hedgesWon: number;
}
export interface RunResult {
  fixtureId: string; attempt: number; runId: string | null; status: string; remedyId: string | null; amountCents: number | null;
  latencyMs: number; passed: boolean; checks: RunChecks; decisiveCoverage: number | null; problem: string | null;
  escalated: boolean; riskOverall: RiskSeverity | null;
  failureClass: FailureClass | null;
  roleLatencySec: Partial<Record<AgentRole, number>>;
  /** Escalation reasons on the completed run (empty when not escalated). */
  escalationReasons: string[];
  /** The Judge's remedy diverged from the deterministic policy verdict. */
  divergent: boolean;
  /** The policy verdict could not be determined from the available evidence. */
  undetermined: boolean;
  /** This result is the API's automatic re-run after a failed first attempt. */
  retried: boolean;
  /** Wall time since the POST, including an automatic re-run (≈ latencyMs otherwise). */
  wallMs: number;
  /** Per-call model spans and recovery counters, folded across firstAttempt too. */
  modelStats: RunModelStats;
  probe?: 'feedback';
  feedbackPrecedent?: CheckResult;
}
export interface GateCondition { name: string; ok: boolean; detail: string }
export interface GateResult { passed: boolean; conditions: GateCondition[] }
export interface ModelCallStat { p50: number | null; p90: number | null; max: number | null }
export interface FeedbackProbe {
  confirmFixtureId: 'X2'; confirmRunId: string | null;
  overrideFixtureId: 'N2H'; overrideRunId: string | null; overrideRemedyId: 'refund_no_show_fee';
  overrideAmountCents: number | null; expectedOverrideAmountCents: number | null;
  problems: string[];
}
export interface Metrics {
  runs: number; runsPassed: number; fixturesRun: number; fixturesPassed: number; exactMoney: number; citationValid: number;
  traceComplete: number; consistentFixtures: number; repeatedFixtures: number; p50LatencySec: number | null; maxLatencySec: number | null;
  riskIntact: number; escalatedRuns: number; escalatedOutcomeUnchanged: number; feedbackProbe: 'pass' | 'fail' | 'not run';
  failureClasses: Record<FailureClass, number>;
  roleLatency: Record<AgentRole, {p50: number | null; max: number | null}>;
  /** Completed, unescalated runs whose finalised remedy equals the policy verdict. */
  verdictAgree: number;
  divergentRuns: number;
  undeterminedRuns: number;
  /** Results that came from the API's automatic re-run after a failed first attempt. */
  providerRetries: number;
  /** Per-call model spans (s): tool-request, case and judge show p50/p90/max; risk shows p50/max. */
  modelCalls: {toolRequest: ModelCallStat; case: ModelCallStat; judge: ModelCallStat; risk: {p50: number | null; max: number | null}};
  /** output.repair events that cost an extra model call. */
  directedRepairs: number;
  /** output.normalised events — a cosmetic fix applied without an extra call. */
  normalisations: number;
  /** model.retry events across all attempts. */
  callRetries: number;
  /** model.hedge events: fired ('hedged request started') and won ('answered first'). */
  hedgesFired: number;
  hedgesWon: number;
}
export interface EvalReport {
  startedAt: string; baseUrl: string; outDir: string; runs: RunResult[]; metrics: Metrics;
  gate: GateResult | null; feedback: FeedbackProbe | null;
  /** Model settings reported by the API's /api/health (undefined when unavailable). */
  model?: {provider: string; thinking: string; serviceTier: string};
}
