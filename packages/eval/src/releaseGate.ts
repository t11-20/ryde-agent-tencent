import type { RunResult } from "./checks.js";

export const GATE_TIMEOUT_MS = 90_000;
export const GOLDEN = ["R1", "R2", "R3", "N1", "N2", "N3"] as const;

export interface GateRule { rule: string; ok: boolean; detail: string }
export interface ReleaseGate { passed: boolean; rules: GateRule[] }

const byFixture = (runs: RunResult[], id: string) => runs.filter((r) => r.fixtureId === id).sort((a, b) => a.attempt - b.attempt);

function consecutivePasses(runs: RunResult[]): number {
  let best = 0, cur = 0;
  for (const r of runs) { cur = r.passed ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}

/** Plan section 12.3. Fixtures that were not run fail their rule ("not run"). */
export function releaseGate(runs: RunResult[]): ReleaseGate {
  const rules: GateRule[] = [];
  for (const id of GOLDEN) {
    const rs = byFixture(runs, id);
    rules.push({ rule: `golden ${id} passes at least once`, ok: rs.some((r) => r.passed), detail: rs.length ? `${rs.filter((r) => r.passed).length}/${rs.length} passed` : "not run" });
  }
  for (const id of ["R1", "N2"]) {
    const rs = byFixture(runs, id);
    const c = consecutivePasses(rs);
    rules.push({ rule: `${id} passes 3 consecutive runs`, ok: c >= 3, detail: rs.length ? `best streak ${c} of ${rs.length} runs` : "not run" });
  }
  for (const id of ["X1", "X3"]) {
    const rs = byFixture(runs, id);
    const good = rs.length > 0 && rs.every((r) => r.observedStatus === "incomplete" && r.amountCents === null && r.remedyId === null);
    rules.push({ rule: `${id} ends incomplete with no amount`, ok: good, detail: rs.length ? rs.map((r) => `${r.observedStatus}/${r.amountCents ?? "no amount"}`).join(", ") : "not run" });
  }
  for (const id of ["X2", "N2H"]) {
    const rs = byFixture(runs, id);
    const good = rs.length > 0 && rs.every((r) => r.observedStatus === "completed" && r.remedyId === "keep_charge");
    rules.push({ rule: `${id} ends keep_charge`, ok: good, detail: rs.length ? rs.map((r) => `${r.observedStatus}/${r.remedyId ?? "none"}`).join(", ") : "not run" });
  }
  const slow = runs.filter((r) => r.timedOut || r.latencyMs > GATE_TIMEOUT_MS);
  rules.push({ rule: "no run times out past 90 s", ok: runs.length > 0 && slow.length === 0, detail: runs.length === 0 ? "no runs" : slow.length ? slow.map((r) => `${r.fixtureId}#${r.attempt}`).join(", ") : `all ${runs.length} runs within 90 s` });
  return { passed: rules.every((r) => r.ok), rules };
}
