#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadDataset } from "@fairtrip/evidence/node";
import { evaluateRun, type RawRun, type RunResult } from "./checks.js";
import { fixtureFacts } from "./facts.js";
import { releaseGate, GOLDEN } from "./releaseGate.js";
import { executeRun } from "./runner.js";
import { buildScorecard, scorecardMarkdown, type Scorecard } from "./scorecard.js";

export interface EvalOptions {
  baseUrl: string;
  fixtures: string;
  repeat: number;
  timeoutSec: number;
  delayMs: number;
  pollMs: number;
  concurrency: number;
  out: string;
  releaseGate: boolean;
  label: string | null;
}

export const USAGE = `Usage: npm run eval -- [options]
  --base-url <url>      Lane A API (default http://localhost:3001)
  --fixtures <set>      golden | all | release | R1,N2,...  (default golden)
                        release = the six goldens + X1,X2,X3,N2H, with R1 and N2 run max(repeat,3) times
  --repeat <n>          runs per fixture (default 1)
  --timeout-sec <s>     per-run timeout (default 90)
  --delay-ms <ms>       pause between runs (default 2000)
  --poll-ms <ms>        polling interval (default 1000)
  --concurrency <n>     parallel runs (default 1; the model provider has rate windows)
  --out <dir>           results directory (default results)
  --release-gate        exit non-zero unless the plan 12.3 release gate passes
  --label <text>        label printed at the top of the scorecard`;

export function parseCli(argv: string[]): EvalOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      "base-url": { type: "string", default: "http://localhost:3001" },
      fixtures: { type: "string", default: "golden" },
      repeat: { type: "string", default: "1" },
      "timeout-sec": { type: "string", default: "90" },
      "delay-ms": { type: "string", default: "2000" },
      "poll-ms": { type: "string", default: "1000" },
      concurrency: { type: "string", default: "1" },
      out: { type: "string", default: "results" },
      "release-gate": { type: "boolean", default: false },
      label: { type: "string" },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (values.help) { console.log(USAGE); process.exit(0); }
  const num = (k: string, v: string, min: number): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min) throw new Error(`--${k} must be a number >= ${min}, got ${v}`);
    return n;
  };
  return {
    baseUrl: values["base-url"],
    fixtures: values.fixtures,
    repeat: Math.floor(num("repeat", values.repeat, 1)),
    timeoutSec: num("timeout-sec", values["timeout-sec"], 0.01),
    delayMs: num("delay-ms", values["delay-ms"], 0),
    pollMs: num("poll-ms", values["poll-ms"], 1),
    concurrency: Math.floor(num("concurrency", values.concurrency, 1)),
    out: values.out,
    releaseGate: values["release-gate"],
    label: values.label ?? null,
  };
}

/** Expands --fixtures/--repeat into an ordered plan of (fixtureId, attempt). */
export function planRuns(spec: string, repeat: number, known: string[]): { fixtureId: string; attempt: number }[] {
  const counts = new Map<string, number>();
  if (spec === "golden") GOLDEN.forEach((id) => counts.set(id, repeat));
  else if (spec === "all") known.forEach((id) => counts.set(id, repeat));
  else if (spec === "release") {
    [...GOLDEN, "X1", "X2", "X3", "N2H"].forEach((id) => counts.set(id, repeat));
    counts.set("R1", Math.max(repeat, 3));
    counts.set("N2", Math.max(repeat, 3));
  } else {
    for (const id of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!known.includes(id)) throw new Error(`unknown fixture ${id}; known: ${known.join(", ")}`);
      counts.set(id, repeat);
    }
  }
  const plan: { fixtureId: string; attempt: number }[] = [];
  const max = Math.max(0, ...counts.values());
  // Round-robin so repeats of one fixture are spread across the session (same order every time).
  for (let a = 1; a <= max; a++) for (const [id, n] of counts) if (a <= n) plan.push({ fixtureId: id, attempt: a });
  return plan;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runEval(o: EvalOptions, log: (s: string) => void = console.log): Promise<{ scorecard: Scorecard; dir: string; raw: RawRun[] }> {
  const dataset = loadDataset();
  const plan = planRuns(o.fixtures, o.repeat, dataset.fixtures.map((f) => f.fixtureId));
  if (plan.length === 0) throw new Error("no runs planned");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(o.out, stamp);
  mkdirSync(join(dir, "runs"), { recursive: true });
  const raw: RawRun[] = new Array(plan.length);
  const results: RunResult[] = new Array(plan.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < plan.length) {
      const i = next++;
      const p = plan[i] as { fixtureId: string; attempt: number };
      if (i > 0 && o.delayMs > 0) await sleep(o.delayMs);
      const r = await executeRun(p.fixtureId, p.attempt, { baseUrl: o.baseUrl, timeoutMs: o.timeoutSec * 1000, pollMs: o.pollMs });
      raw[i] = r;
      writeFileSync(join(dir, "runs", `${p.fixtureId}-${p.attempt}.json`), `${JSON.stringify(r, null, 2)}\n`);
      const res = evaluateRun(r, fixtureFacts(dataset, p.fixtureId));
      results[i] = res;
      log(`${res.passed ? "PASS" : "FAIL"} ${p.fixtureId}#${p.attempt} ${res.observedStatus} ${res.remedyId ?? "-"} ${res.amountCents ?? "-"} (${(res.latencyMs / 1000).toFixed(1)} s)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(o.concurrency, plan.length) }, worker));
  const gate = o.releaseGate ? releaseGate(results) : null;
  const scorecard = buildScorecard(results, {
    baseUrl: o.baseUrl, label: o.label, gate,
    options: { fixtures: o.fixtures, repeat: o.repeat, timeoutSec: o.timeoutSec, delayMs: o.delayMs, pollMs: o.pollMs, concurrency: o.concurrency },
  });
  writeFileSync(join(dir, "scorecard.json"), `${JSON.stringify(scorecard, null, 2)}\n`);
  writeFileSync(join(dir, "scorecard.md"), scorecardMarkdown(scorecard));
  log(`Scorecard: ${join(dir, "scorecard.md")}`);
  if (gate) log(`Release gate: ${gate.passed ? "PASSED" : "FAILED"}`);
  return { scorecard, dir, raw };
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]).endsWith(join("src", "cli.ts"));
if (isMain) {
  try {
    const o = parseCli(process.argv.slice(2));
    const { scorecard } = await runEval(o);
    if (o.releaseGate && !scorecard.releaseGate?.passed) process.exit(2);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(USAGE);
    process.exit(1);
  }
}
