import type { RunResult } from "./checks.js";
import type { ReleaseGate } from "./releaseGate.js";

export interface FixtureSummary {
  fixtureId: string;
  runs: number;
  passes: number;
  /** null when the fixture ran once */
  consistent: boolean | null;
  outcomes: string[];
}

export interface Scorecard {
  generatedAt: string;
  label: string | null;
  baseUrl: string;
  options: Record<string, unknown>;
  totals: {
    runs: number;
    passedRuns: number;
    fixturesRun: number;
    fixturesPassedAtLeastOnce: number;
    amountExact: { exact: number; of: number };
    citationsValid: { valid: number; of: number };
    traceComplete: { complete: number; of: number };
    noReasoningLeak: { clean: number; of: number };
    consistency: { consistent: number; of: number };
    decisiveCoverageMean: number | null;
    latencyMs: { p50: number | null; max: number | null; measuredRuns: number; timedOut: number };
    usage: { modelCalls: number | null; inputTokens: number | null; outputTokens: number | null; runsReporting: number };
  };
  fixtures: FixtureSummary[];
  runs: RunResult[];
  releaseGate: ReleaseGate | null;
}

const outcomeKey = (r: RunResult): string => `${r.observedStatus}|${r.remedyId ?? "-"}|${r.amountCents ?? "-"}`;

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : Math.round(((s[m - 1] as number) + (s[m] as number)) / 2);
}

function sumOrNull(runs: RunResult[], k: "modelCalls" | "inputTokens" | "outputTokens"): number | null {
  const vals = runs.map((r) => r.usage?.[k]).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

export function buildScorecard(runs: RunResult[], meta: { baseUrl: string; label: string | null; options: Record<string, unknown>; gate: ReleaseGate | null; now?: Date }): Scorecard {
  const ids = [...new Set(runs.map((r) => r.fixtureId))];
  const fixtures: FixtureSummary[] = ids.map((id) => {
    const rs = runs.filter((r) => r.fixtureId === id);
    const keys = rs.map(outcomeKey);
    return { fixtureId: id, runs: rs.length, passes: rs.filter((r) => r.passed).length, consistent: rs.length > 1 ? new Set(keys).size === 1 : null, outcomes: keys };
  });
  const terminal = runs.filter((r) => !r.timedOut && r.error?.code !== "network_error" && r.error?.code !== "contract_mismatch");
  const lat = terminal.map((r) => r.latencyMs);
  const cov = runs.map((r) => r.checks.decisiveCoverage.value).filter((v): v is number => v !== null);
  const repeated = fixtures.filter((f) => f.consistent !== null);
  return {
    generatedAt: (meta.now ?? new Date()).toISOString(),
    label: meta.label,
    baseUrl: meta.baseUrl,
    options: meta.options,
    totals: {
      runs: runs.length,
      passedRuns: runs.filter((r) => r.passed).length,
      fixturesRun: ids.length,
      fixturesPassedAtLeastOnce: fixtures.filter((f) => f.passes > 0).length,
      amountExact: { exact: runs.filter((r) => r.checks.amountExact.ok).length, of: runs.length },
      citationsValid: { valid: runs.filter((r) => r.checks.citationsValid.ok).length, of: runs.length },
      traceComplete: { complete: runs.filter((r) => r.checks.traceComplete.ok).length, of: runs.length },
      noReasoningLeak: { clean: runs.filter((r) => r.checks.noReasoningLeak.ok).length, of: runs.length },
      consistency: { consistent: repeated.filter((f) => f.consistent).length, of: repeated.length },
      decisiveCoverageMean: cov.length ? Math.round((cov.reduce((a, b) => a + b, 0) / cov.length) * 1000) / 1000 : null,
      latencyMs: { p50: median(lat), max: lat.length ? Math.max(...lat) : null, measuredRuns: lat.length, timedOut: runs.filter((r) => r.timedOut).length },
      usage: {
        modelCalls: sumOrNull(runs, "modelCalls"),
        inputTokens: sumOrNull(runs, "inputTokens"),
        outputTokens: sumOrNull(runs, "outputTokens"),
        runsReporting: runs.filter((r) => r.usage && Object.keys(r.usage).length > 0).length,
      },
    },
    fixtures,
    runs,
    releaseGate: meta.gate,
  };
}

const NM = "Not measured";
const frac = (a: number, b: number): string => (b === 0 ? NM : `${a}/${b} (${Math.round((a / b) * 1000) / 10}%)`);
const ms = (x: number | null): string => (x === null ? NM : `${(x / 1000).toFixed(1)} s`);
const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function scorecardMarkdown(sc: Scorecard): string {
  const t = sc.totals;
  const L: string[] = [
    "# FairTrip evaluation scorecard",
    "",
    ...(sc.label ? [`> **${sc.label}**`, ""] : []),
    `- Generated: ${sc.generatedAt}`,
    `- API: \`${sc.baseUrl}\``,
    `- Options: \`${JSON.stringify(sc.options)}\``,
    "- Data: SYNTHETIC fixtures; rules: DEMONSTRATION POLICY (not Ryde policy).",
    "",
    "## Summary",
    "",
    "| Measure | Result |",
    "|---|---|",
    `| Fixtures passing (at least once) | ${frac(t.fixturesPassedAtLeastOnce, t.fixturesRun)} |`,
    `| Runs passing all checks | ${frac(t.passedRuns, t.runs)} |`,
    `| Exact monetary correctness | ${frac(t.amountExact.exact, t.amountExact.of)} |`,
    `| Citation validity | ${frac(t.citationsValid.valid, t.citationsValid.of)} |`,
    `| Repeated-run consistency | ${t.consistency.of === 0 ? `${NM} (no fixture was repeated)` : frac(t.consistency.consistent, t.consistency.of)} |`,
    `| Trace completeness | ${frac(t.traceComplete.complete, t.traceComplete.of)} |`,
    `| No reasoning leak | ${frac(t.noReasoningLeak.clean, t.noReasoningLeak.of)} |`,
    `| Decisive-evidence coverage (mean, reported only) | ${t.decisiveCoverageMean === null ? NM : `${Math.round(t.decisiveCoverageMean * 1000) / 10}%`} |`,
    `| Latency p50 | ${ms(t.latencyMs.p50)} |`,
    `| Latency max | ${ms(t.latencyMs.max)} |`,
    `| Timed-out runs | ${t.runs === 0 ? NM : String(t.latencyMs.timedOut)} |`,
    `| Model calls (total) | ${t.usage.modelCalls === null ? NM : String(t.usage.modelCalls)} |`,
    `| Input tokens (total) | ${t.usage.inputTokens === null ? NM : String(t.usage.inputTokens)} |`,
    `| Output tokens (total) | ${t.usage.outputTokens === null ? NM : String(t.usage.outputTokens)} |`,
    "",
  ];
  if (sc.releaseGate) {
    L.push(`## Release gate: ${sc.releaseGate.passed ? "PASSED" : "FAILED"}`, "", "| Rule | OK | Detail |", "|---|---|---|");
    for (const r of sc.releaseGate.rules) L.push(`| ${cell(r.rule)} | ${r.ok ? "yes" : "**no**"} | ${cell(r.detail)} |`);
    L.push("");
  }
  L.push("## Fixtures", "", "| Fixture | Runs | Passes | Consistent | Outcomes (status/remedy/cents) |", "|---|---|---|---|---|");
  for (const f of sc.fixtures) L.push(`| ${f.fixtureId} | ${f.runs} | ${f.passes} | ${f.consistent === null ? "n/a (1 run)" : f.consistent ? "yes" : "**no**"} | ${cell(f.outcomes.join(", "))} |`);
  L.push("", "## Runs", "", "| Fixture | # | Status | Remedy | Cents | Pass | Failed checks | Latency |", "|---|---|---|---|---|---|---|---|");
  for (const r of sc.runs) {
    const failed = (["statusMatch", "remedyMatch", "amountExact", "citationsValid", "traceComplete", "noReasoningLeak"] as const)
      .filter((k) => !r.checks[k].ok)
      .map((k) => `${k}: ${r.checks[k].detail}`);
    L.push(`| ${r.fixtureId} | ${r.attempt} | ${r.observedStatus} | ${r.remedyId ?? "—"} | ${r.amountCents ?? "—"} | ${r.passed ? "yes" : "**no**"} | ${cell(failed.join("; ")) || "—"} | ${ms(r.latencyMs)} |`);
  }
  L.push("");
  return L.join("\n");
}
