import type { EvidenceFamily, ExpectedOutcome } from "@fairtrip/evidence";
import type { RunEvent, RunView } from "./contracts.js";
import { TRACE_RULES } from "./traceRules.js";

/** Facts about the fixture the checks need (from @fairtrip/evidence/node). */
export interface FixtureFacts {
  expected: ExpectedOutcome;
  evidenceIds: string[];
  clauseIds: string[];
  /** evidence ID -> family, for the fixture's full evidence catalogue */
  familyOf: Record<string, EvidenceFamily>;
  availableFamilies: EvidenceFamily[];
}

export interface RawRun {
  fixtureId: string;
  attempt: number;
  runId: string | null;
  startedAt: string;
  latencyMs: number;
  timedOut: boolean;
  /** Transport / contract error that prevented observing a terminal status. */
  error: { code: string; message: string } | null;
  view: RunView | null;
}

export interface CheckResult { ok: boolean; detail: string }

export interface RunChecks {
  statusMatch: CheckResult;
  remedyMatch: CheckResult;
  amountExact: CheckResult;
  citationsValid: CheckResult & { unknownEvidenceIds: string[]; unknownPolicyIds: string[] };
  decisiveCoverage: { value: number | null; cited: string[]; missing: string[] };
  traceComplete: CheckResult & { problems: string[] };
  noReasoningLeak: CheckResult & { locations: string[] };
}

export interface RunResult {
  fixtureId: string;
  attempt: number;
  runId: string | null;
  observedStatus: string;
  remedyId: string | null;
  amountCents: number | null;
  latencyMs: number;
  timedOut: boolean;
  passed: boolean;
  checks: RunChecks;
  usage: { modelCalls?: number; inputTokens?: number; outputTokens?: number } | null;
  error: { code: string; message: string } | null;
}

const ok = (detail: string): CheckResult => ({ ok: true, detail });
const fail = (detail: string): CheckResult => ({ ok: false, detail });

export function observedStatus(run: RawRun): string {
  if (run.timedOut) return "timeout";
  if (!run.view) return run.error?.code ?? "error";
  return run.view.status;
}

export function checkStatus(run: RawRun, exp: ExpectedOutcome): CheckResult {
  const v = run.view;
  const st = observedStatus(run);
  if (exp.status === "resolved") {
    if (st !== "completed") return fail(`expected completed, got ${st}`);
    if (!v?.result?.action) return fail("completed without a result and action");
    return ok("completed with a result");
  }
  if (st !== "incomplete") return fail(`expected incomplete, got ${st}`);
  if (v?.result?.action) return fail(`incomplete run carries an action (${v.result.action.remedyId}, ${String(v.result.action.amountCents)})`);
  return ok("incomplete with no action amount");
}

export function checkRemedy(run: RawRun, exp: ExpectedOutcome): CheckResult {
  const action = run.view?.result?.action;
  if (exp.remedyId === null) return action ? fail(`expected no remedy, got ${action.remedyId}`) : ok("no remedy, as expected");
  if (!action) return fail(`expected ${exp.remedyId}, got no action`);
  return action.remedyId === exp.remedyId ? ok(exp.remedyId) : fail(`expected ${exp.remedyId}, got ${action.remedyId}`);
}

export function checkAmount(run: RawRun, exp: ExpectedOutcome): CheckResult {
  const action = run.view?.result?.action;
  if (exp.amountCents === null) return action ? fail(`expected no amount, got ${String(action.amountCents)}`) : ok("no amount, as expected");
  if (!action) return fail(`expected ${exp.amountCents} cents, got no action`);
  return action.amountCents === exp.amountCents ? ok(`${exp.amountCents} cents`) : fail(`expected ${exp.amountCents} cents, got ${String(action.amountCents)}`);
}

function citedPoints(v: RunView | null) {
  if (!v) return [];
  return [
    ...(v.cases?.rider?.arguments ?? []), ...(v.cases?.rider?.counterevidence ?? []),
    ...(v.cases?.driver?.arguments ?? []), ...(v.cases?.driver?.counterevidence ?? []),
    ...(v.result?.judge.findings ?? []),
  ];
}

export function checkCitations(run: RawRun, facts: FixtureFacts): RunChecks["citationsValid"] {
  const ev = new Set(facts.evidenceIds);
  const pol = new Set(facts.clauseIds);
  const pts = citedPoints(run.view);
  const unknownEvidenceIds = [...new Set(pts.flatMap((p) => p.evidenceIds).filter((id) => !ev.has(id)))];
  const unknownPolicyIds = [...new Set(pts.flatMap((p) => p.policyIds).filter((id) => !pol.has(id)))];
  const good = unknownEvidenceIds.length === 0 && unknownPolicyIds.length === 0;
  const n = pts.reduce((s, p) => s + p.evidenceIds.length + p.policyIds.length, 0);
  return {
    ok: good,
    detail: good ? `${n} citations, all known` : `unknown: ${[...unknownEvidenceIds, ...unknownPolicyIds].join(", ")}`,
    unknownEvidenceIds,
    unknownPolicyIds,
  };
}

export function decisiveCoverage(run: RawRun, exp: ExpectedOutcome): RunChecks["decisiveCoverage"] {
  const findings = run.view?.result?.judge.findings;
  if (!findings || exp.decisiveEvidenceIds.length === 0) return { value: null, cited: [], missing: [...exp.decisiveEvidenceIds] };
  const citedSet = new Set(findings.flatMap((f) => f.evidenceIds));
  const cited = exp.decisiveEvidenceIds.filter((id) => citedSet.has(id));
  return { value: Math.round((cited.length / exp.decisiveEvidenceIds.length) * 1000) / 1000, cited, missing: exp.decisiveEvidenceIds.filter((id) => !citedSet.has(id)) };
}

export function checkTrace(run: RawRun, facts: FixtureFacts): RunChecks["traceComplete"] {
  const events: RunEvent[] = [...(run.view?.events ?? [])].sort((a, b) => a.sequence - b.sequence);
  const { actors, types } = TRACE_RULES;
  const problems: string[] = [];
  const advocates = [actors.riderAdvocate, actors.driverAdvocate];
  for (const actor of advocates) {
    if (!events.some((e) => e.actor === actor && e.type === types.toolRequested)) problems.push(`${actor}: no ${types.toolRequested}`);
    if (!events.some((e) => e.actor === actor && e.type === types.toolResult)) problems.push(`${actor}: no ${types.toolResult}`);
  }
  const retrievedIds = [
    ...events.filter((e) => (advocates as readonly string[]).includes(e.actor) && e.type === types.toolResult).flatMap((e) => e.refs?.evidenceIds ?? []),
    ...(run.view?.evidence ?? []).map((r) => r.id),
  ];
  const families = new Set(retrievedIds.map((id) => facts.familyOf[id]).filter((f): f is EvidenceFamily => f !== undefined));
  const notRetrieved = facts.availableFamilies.filter((f) => !families.has(f));
  if (notRetrieved.length) problems.push(`available families never retrieved: ${notRetrieved.join(", ")}`);
  const submitted = advocates.map((actor) => events.find((e) => e.actor === actor && e.type === types.caseSubmitted));
  advocates.forEach((actor, i) => { if (!submitted[i]) problems.push(`${actor}: no ${types.caseSubmitted}`); });
  const handoff = events.find((e) => e.type === types.handoffToJudge);
  if (!handoff) problems.push(`no ${types.handoffToJudge}`);
  else if (submitted.some((s) => s && s.sequence > handoff.sequence)) problems.push(`${types.handoffToJudge} before both ${types.caseSubmitted}`);
  if (!events.some((e) => (types.terminal as readonly string[]).includes(e.type))) problems.push("no terminal event");
  return { ok: problems.length === 0, detail: problems.length ? problems.join("; ") : "complete", problems };
}

const LEAK_STRINGS = ["<think>", "</think>"];
const LEAK_KEY = "reasoning_content";

function scan(x: unknown, path: string, out: string[], strings: boolean): void {
  if (typeof x === "string") {
    if (strings && LEAK_STRINGS.some((s) => x.includes(s))) out.push(path);
  } else if (Array.isArray(x)) {
    x.forEach((v, i) => scan(v, `${path}[${i}]`, out, strings));
  } else if (x && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      if (k === LEAK_KEY) out.push(`${path}.${k}`);
      scan(v, `${path}.${k}`, out, strings);
    }
  }
}

/** `<think>` / `</think>` in strings of cases, result, events[].summary or error; a `reasoning_content` key anywhere. */
export function checkNoReasoningLeak(run: RawRun): RunChecks["noReasoningLeak"] {
  const v = run.view;
  const locations: string[] = [];
  if (v) {
    scan(v.cases, "cases", locations, true);
    scan(v.result, "result", locations, true);
    scan(v.error, "error", locations, true);
    v.events.forEach((e, i) => scan(e.summary, `events[${i}].summary`, locations, true));
    scan(v, "view", locations, false);
  }
  const uniq = [...new Set(locations)];
  return { ok: uniq.length === 0, detail: uniq.length ? `leak at ${uniq.join(", ")}` : "no leak", locations: uniq };
}

export function evaluateRun(run: RawRun, facts: FixtureFacts): RunResult {
  const exp = facts.expected;
  const checks: RunChecks = {
    statusMatch: checkStatus(run, exp),
    remedyMatch: checkRemedy(run, exp),
    amountExact: checkAmount(run, exp),
    citationsValid: checkCitations(run, facts),
    decisiveCoverage: decisiveCoverage(run, exp),
    traceComplete: checkTrace(run, facts),
    noReasoningLeak: checkNoReasoningLeak(run),
  };
  const action = run.view?.result?.action;
  const u = run.view?.usage;
  return {
    fixtureId: run.fixtureId,
    attempt: run.attempt,
    runId: run.runId,
    observedStatus: observedStatus(run),
    remedyId: action?.remedyId ?? null,
    amountCents: action?.amountCents ?? null,
    latencyMs: run.latencyMs,
    timedOut: run.timedOut,
    passed:
      checks.statusMatch.ok && checks.remedyMatch.ok && checks.amountExact.ok &&
      checks.citationsValid.ok && checks.traceComplete.ok && checks.noReasoningLeak.ok,
    checks,
    usage: u ? { ...(u.modelCalls !== undefined ? { modelCalls: u.modelCalls } : {}), ...(u.inputTokens !== undefined ? { inputTokens: u.inputTokens } : {}), ...(u.outputTokens !== undefined ? { outputTokens: u.outputTokens } : {}) } : null,
    error: run.error ?? (run.view?.error ? { code: run.view.error.code, message: run.view.error.message } : null),
  };
}
