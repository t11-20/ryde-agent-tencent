import { RISK_CAVEAT } from '@fairtrip/contracts';
import type { Evidence, FinalAction, PolicyVerdict, RiskAssessment, RiskSignal, Run } from '@fairtrip/contracts';
import { assessRisk, buildEvidence, caseFeatures, findExpected, findFixture, policyClausesFor, policyVerdict, type Dataset, type ExpectedOutcome } from '@fairtrip/evidence';
import { z } from 'zod';
import type { RawRun } from './client.js';
import type { AgentRole, CheckResult, FailureClass, RunChecks, RunModelStats, RunResult } from './report.js';

export interface FixtureFacts {
  expected: ExpectedOutcome; recordIds: string[]; familiesWithRecords: string[]; clauseIds: string[];
  /** Evidence ID → family, for every record of the fixture. */
  recordFamilies: Record<string, string>;
  /** Deterministic risk assessment derived from the fixture's own evidence. */
  expectedRisk: RiskAssessment;
  /** Deterministic policy verdict derived from the fixture's computed features. */
  verdict: PolicyVerdict;
  /** Server-computed eligible cents per remedy, from the PAY-REMEDY record (null = unavailable). */
  eligibleCents: Record<FinalAction['remedyId'], number | null>;
}

type RemedyId = FinalAction['remedyId'];
const REMEDY_IDS: RemedyId[] = ['keep_charge', 'refund_route_excess', 'refund_no_show_fee'];
const RemedyBasisSchema = z.looseObject({
  basis: z.array(z.looseObject({remedyId: z.string(), eligibleCents: z.number().nullable()}))
});

function readEligibleCents(records: Evidence[]): Record<RemedyId, number | null> {
  const eligible: Record<RemedyId, number | null> = {keep_charge: null, refund_route_excess: null, refund_no_show_fee: null};
  const record = records.find(item => item.id === 'PAY-REMEDY');
  if (record === undefined) return eligible;
  const parsed = RemedyBasisSchema.safeParse(record.facts);
  if (!parsed.success) return eligible;
  for (const entry of parsed.data.basis) {
    if (REMEDY_IDS.includes(entry.remedyId as RemedyId)) eligible[entry.remedyId as RemedyId] = entry.eligibleCents;
  }
  return eligible;
}

const DEADLINE_MS = 90_000;
const TERMINAL_STATUSES = new Set(['completed', 'incomplete', 'failed']);
const TERMINAL_EVENTS = new Set(['run.completed', 'run.incomplete', 'run.failed']);

export function fixtureFacts(dataset: Dataset, fixtureId: string): FixtureFacts {
  const fixture = findFixture(dataset, fixtureId);
  const expected = findExpected(dataset, fixtureId);
  if (fixture === undefined || expected === undefined) throw new Error(`Unknown fixture: ${fixtureId}`);
  const bundle = buildEvidence(fixture, dataset.policy);
  const records = bundle.records;
  const recordFamilies: Record<string, string> = {};
  const families: string[] = [];
  for (const record of records) {
    recordFamilies[record.id] = record.source;
    if (!families.includes(record.source)) families.push(record.source);
  }
  return {
    expected,
    recordIds: records.map(record => record.id),
    familiesWithRecords: families,
    clauseIds: policyClausesFor(dataset.policy, fixture.dispute.category).map(clause => clause.id),
    recordFamilies,
    expectedRisk: assessRisk(records),
    verdict: policyVerdict(fixture.dispute.category, caseFeatures(records, fixture.dispute.category), bundle.unavailable),
    eligibleCents: readEligibleCents(records)
  };
}

const ok = (detail = 'ok'): CheckResult => ({ok: true, detail});
const fail = (detail: string): CheckResult => ({ok: false, detail});

function terminalRun(raw: RawRun): Run | null {
  return raw.run !== null && TERMINAL_STATUSES.has(raw.run.status) ? raw.run : null;
}

function checkStatus(run: Run | null, expected: ExpectedOutcome): CheckResult {
  if (run === null) return fail('no terminal run');
  if (expected.expectedStatus === 'completed') {
    return run.status === 'completed' ? ok() : fail(`expected completed, got ${run.status}`);
  }
  if (run.status !== 'incomplete') return fail(`expected incomplete, got ${run.status}`);
  return 'result' in run ? fail('incomplete run has a result') : ok();
}

function checkRemedy(run: Run | null, expected: ExpectedOutcome): CheckResult {
  if (expected.expectedStatus === 'incomplete') {
    return run !== null && run.status === 'completed' ? fail('incomplete expected but a result exists') : ok();
  }
  if (run === null || run.status !== 'completed') return fail('no result');
  const actual = run.result.action.remedyId;
  return actual === expected.expectedRemedyId ? ok() : fail(`expected ${String(expected.expectedRemedyId)}, got ${actual}`);
}

function checkAmount(run: Run | null, expected: ExpectedOutcome): CheckResult {
  if (expected.expectedStatus === 'incomplete') {
    return run !== null && run.status === 'completed' ? fail('incomplete expected but a result exists') : ok();
  }
  if (run === null || run.status !== 'completed') return fail('no result');
  const actual = run.result.action.amountCents;
  return actual === expected.expectedAmountCents ? ok() : fail(`expected ${String(expected.expectedAmountCents)}, got ${actual}`);
}

function checkCitations(run: Run | null, facts: FixtureFacts): CheckResult {
  if (run === null) return fail('no terminal run');
  const recordIds = new Set(facts.recordIds);
  const clauseIds = new Set(facts.clauseIds);
  const citations = run.cases.flatMap(advocateCase => [...advocateCase.arguments, ...advocateCase.counterevidence]);
  if (run.status === 'completed') citations.push(...run.result.findings);
  const badEvidence = new Set<string>();
  const badClauses = new Set<string>();
  for (const citation of citations) {
    for (const id of citation.evidenceIds) if (!recordIds.has(id)) badEvidence.add(id);
    for (const id of citation.policyClauseIds) if (!clauseIds.has(id)) badClauses.add(id);
  }
  const problems: string[] = [];
  if (badEvidence.size > 0) problems.push(`unknown evidence ${[...badEvidence].join(', ')}`);
  if (badClauses.size > 0) problems.push(`unknown clauses ${[...badClauses].join(', ')}`);
  return problems.length === 0 ? ok() : fail(problems.join('; '));
}

function checkTrace(run: Run | null, facts: FixtureFacts): CheckResult {
  if (run === null) return fail('no terminal run');
  const events = run.events;
  const problems: string[] = [];
  const judgeIndex = events.findIndex(event => event.type === 'judge.started');
  if (judgeIndex === -1) problems.push('no judge.started');
  for (const side of ['rider', 'driver'] as const) {
    const sideEvents = events.filter(event => event.actor === side);
    for (const type of ['tool.requested', 'evidence.retrieved', 'policy.retrieved'] as const) {
      if (!sideEvents.some(event => event.type === type)) problems.push(`${side}: no ${type}`);
    }
    const completedCount = sideEvents.filter(event => event.type === 'case.completed').length;
    if (completedCount !== 1) problems.push(`${side}: ${completedCount} case.completed`);
    const caseIndex = events.findIndex(event => event.actor === side && event.type === 'case.completed');
    if (judgeIndex !== -1 && caseIndex !== -1 && judgeIndex < caseIndex) problems.push(`judge.started before ${side} case.completed`);
  }
  const covered = new Set<string>();
  for (const event of events) {
    if (event.type !== 'evidence.retrieved') continue;
    for (const id of event.evidenceIds) {
      const family = facts.recordFamilies[id];
      if (family !== undefined) covered.add(family);
    }
  }
  const uncovered = facts.familiesWithRecords.filter(family => !covered.has(family));
  if (uncovered.length > 0) problems.push(`families not retrieved: ${uncovered.join(', ')}`);
  const last = events[events.length - 1];
  if (last === undefined || !TERMINAL_EVENTS.has(last.type)) problems.push(`last event is ${last?.type ?? 'missing'}`);
  return problems.length === 0 ? ok() : fail(problems.join('; '));
}

function findLeaks(value: unknown, path: string, checkStrings: boolean, leaks: string[]): void {
  if (typeof value === 'string') {
    if (checkStrings && (value.includes('<think>') || value.includes('</think>'))) leaks.push(`${path}: think tag`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findLeaks(item, `${path}[${index}]`, checkStrings, leaks));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'reasoning_content') leaks.push(`${path}.${key}: reasoning_content key`);
      findLeaks(item, `${path}.${key}`, checkStrings, leaks);
    }
  }
}

function checkReasoningLeak(run: Run | null): CheckResult {
  if (run === null) return fail('no terminal run');
  const leaks: string[] = [];
  findLeaks(run.cases, 'cases', true, leaks);
  if (run.status === 'completed') findLeaks(run.result, 'result', true, leaks);
  if (run.status === 'failed') findLeaks(run.error, 'error', true, leaks);
  run.events.forEach((event, index) => findLeaks(event.summary, `events[${index}].summary`, true, leaks));
  findLeaks(run, 'run', false, leaks);
  const unique = [...new Set(leaks)];
  return unique.length === 0 ? ok() : fail(unique.join('; '));
}

function checkDeadline(raw: RawRun): CheckResult {
  if (raw.timedOut) return fail('timed out');
  return raw.latencyMs <= DEADLINE_MS ? ok() : fail(`latency ${raw.latencyMs} ms > ${DEADLINE_MS} ms`);
}

const signalKey = (signal: Pick<RiskSignal, 'code' | 'party' | 'severity'>): string =>
  `${signal.code}:${signal.party}:${signal.severity}`;

function checkRiskSignals(run: Run | null, expected: RiskAssessment): CheckResult {
  if (run === null) return fail('no terminal run');
  if (run.risk === undefined) {
    return run.status === 'completed' ? fail('no risk assessment') : ok();
  }
  const problems: string[] = [];
  if (run.risk.overall !== expected.overall) problems.push(`overall expected ${expected.overall}, got ${run.risk.overall}`);
  const expectedSignals = expected.signals.map(signalKey).sort();
  const actualSignals = run.risk.signals.map(signalKey).sort();
  if (expectedSignals.join('|') !== actualSignals.join('|'))
    problems.push(`signals differ: expected [${expectedSignals.join(', ')}], got [${actualSignals.join(', ')}]`);
  if (run.risk.caveat !== RISK_CAVEAT) problems.push('caveat changed');
  return problems.length === 0 ? ok() : fail(problems.join('; '));
}

// The deterministic verdict bounds the Judge: a terminal run must carry the
// same verdict the offline facts compute; a completed unescalated ruling must
// equal it; a divergent ruling must be escalated with a divergence record that
// names the verdict. A failed run has no ruling to check.
function checkVerdict(run: Run | null, facts: FixtureFacts): CheckResult {
  if (run === null) return fail('no terminal run');
  if (run.status === 'failed') return ok();
  const verdict = run.verdict;
  if (verdict === undefined) return fail('run carries no policy verdict');
  if (verdict.outcome !== facts.verdict.outcome)
    return fail(`run verdict ${verdict.outcome}, expected ${facts.verdict.outcome}`);
  if (run.status === 'incomplete')
    return verdict.outcome === 'incomplete' ? ok() : fail(`incomplete run but verdict is ${verdict.outcome}`);
  if (run.status !== 'completed') return fail(`run still ${run.status}`);
  const remedy = run.result.action.remedyId;
  if (run.escalation === undefined || !run.escalation.reasons.includes('policy_divergence'))
    return remedy === verdict.outcome ? ok() : fail(`ruling ${remedy} diverges from verdict ${verdict.outcome} without a policy_divergence escalation`);
  const divergence = run.divergence;
  if (divergence === undefined) return fail('escalated for policy_divergence without a divergence record');
  return divergence.verdictOutcome === verdict.outcome
    ? ok()
    : fail(`divergence verdictOutcome ${divergence.verdictOutcome} != verdict ${verdict.outcome}`);
}

function checkContextOnly(run: Run | null, expected: RiskAssessment, remedy: CheckResult, amount: CheckResult): CheckResult {
  if (run === null || run.status !== 'completed') return ok();
  const escalation = run.escalation;
  if (expected.overall === 'high') {
    if (escalation === undefined) return fail('high-risk assessment but no escalation');
    if (!escalation.reasons.includes('high_risk')) return fail('escalation missing high_risk');
  } else if (escalation !== undefined && escalation.reasons.includes('high_risk')) {
    return fail('escalated for high_risk without a high-risk assessment');
  }
  if (escalation !== undefined && (!remedy.ok || !amount.ok)) return fail('escalated run changed the outcome');
  return ok();
}

function decisiveCoverage(run: Run | null, expected: ExpectedOutcome): number | null {
  if (expected.decisiveEvidenceIds.length === 0 || run === null || run.status !== 'completed') return null;
  const cited = new Set(run.result.findings.flatMap(finding => finding.evidenceIds));
  const hits = expected.decisiveEvidenceIds.filter(id => cited.has(id)).length;
  return hits / expected.decisiveEvidenceIds.length;
}

export function checkFeedbackPrecedent(run: Run | null, overrideRunId: string): CheckResult {
  if (run === null) return fail('no terminal probe run');
  if (run.status !== 'completed') return fail(`probe run ${run.status}`);
  const precedents = run.precedents ?? [];
  if (precedents.some(precedent => precedent.origin === 'human_override' && precedent.runId === overrideRunId)) return ok();
  return fail(`no human_override precedent from ${overrideRunId}; saw ${precedents.length === 0 ? 'none' : precedents.map(precedent => precedent.id).join(', ')}`);
}

const MODEL_OUTPUT_PATTERNS = [
  'unparseable output', 'Unknown evidence citation', 'Unknown policy citation',
  'exceeded maximum tool rounds', 'failed schema or citation validation', 'wrong side', 'must independently request'
];

// Classifies a failed check run from the terminal record only — no new data.
// Provider-side classes mean endpoint latency/connectivity, not a decision error.
export function classifyFailure(run: Run | null, checks: RunChecks): FailureClass {
  if (run !== null && run.status === 'failed') {
    const message = run.error.message;
    if (message.includes('aborted due to timeout') || message.includes('TimeoutError')) return 'provider_timeout';
    if (message.includes('fetch failed') || message.includes('network')) return 'provider_network';
    if (message.includes('Run deadline exceeded')) return 'run_deadline';
    if (MODEL_OUTPUT_PATTERNS.some(pattern => message.includes(pattern))) return 'model_output';
    return 'model_output';
  }
  if (run !== null && (run.status === 'completed' || run.status === 'incomplete')
      && (!checks.statusMatch.ok || !checks.remedyMatch.ok || !checks.amountExact.ok)) return 'outcome_mismatch';
  return 'check_failure';
}

const AGENT_ROLES: AgentRole[] = ['rider', 'driver', 'risk', 'judge'];

const EMPTY_STATS: RunModelStats = {
  callSec: {toolRequest: [], case: [], judge: [], risk: []},
  directedRepairs: 0, normalisations: 0, callRetries: 0, hedgesFired: 0, hedgesWon: 0
};

// Per-call spans in seconds (the A/B instrument for latency work):
// tool-request = advocate model.start → its first tool.requested;
// case = that tool.requested → advocate model.finish; judge/risk = start → finish.
// Missing pairs are skipped. Recovery counters come from the event types.
function modelStatsFor(run: Run): RunModelStats {
  const stats: RunModelStats = {
    callSec: {toolRequest: [], case: [], judge: [], risk: []},
    directedRepairs: 0, normalisations: 0, callRetries: 0, hedgesFired: 0, hedgesWon: 0
  };
  const ms = (type: string, actor: string, from: number): number | undefined => {
    const event = run.events.slice(from).find(candidate => candidate.actor === actor && candidate.type === type);
    return event === undefined ? undefined : Date.parse(event.timestamp);
  };
  const push = (list: number[], from: number | undefined, to: number | undefined): void => {
    if (from === undefined || to === undefined) return;
    const span = to - from;
    if (Number.isFinite(span) && span >= 0) list.push(Math.round(span / 100) / 10);
  };
  for (const actor of ['rider', 'driver'] as const) {
    const start = ms('model.start', actor, 0);
    const toolIndex = run.events.findIndex(event => event.actor === actor && event.type === 'tool.requested');
    const finish = ms('model.finish', actor, 0);
    const toolAt = toolIndex === -1 ? undefined : Date.parse(run.events[toolIndex]!.timestamp);
    push(stats.callSec.toolRequest, start, toolAt);
    push(stats.callSec.case, toolAt, finish);
  }
  push(stats.callSec.judge, ms('model.start', 'judge', 0), ms('model.finish', 'judge', 0));
  push(stats.callSec.risk, ms('model.start', 'risk', 0), ms('model.finish', 'risk', 0));
  for (const event of run.events) {
    if (event.type === 'output.repair' && !event.summary.includes('normalised')) stats.directedRepairs += 1;
    else if (event.type === 'output.normalised') stats.normalisations += 1;
    else if (event.type === 'model.retry') stats.callRetries += 1;
    else if (event.type === 'model.hedge') {
      if (event.summary.includes('answered first')) stats.hedgesWon += 1;
      else stats.hedgesFired += 1;
    }
  }
  return stats;
}

function mergeStats(a: RunModelStats, b: RunModelStats): RunModelStats {
  return {
    callSec: {
      toolRequest: [...a.callSec.toolRequest, ...b.callSec.toolRequest],
      case: [...a.callSec.case, ...b.callSec.case],
      judge: [...a.callSec.judge, ...b.callSec.judge],
      risk: [...a.callSec.risk, ...b.callSec.risk]
    },
    directedRepairs: a.directedRepairs + b.directedRepairs,
    normalisations: a.normalisations + b.normalisations,
    callRetries: a.callRetries + b.callRetries,
    hedgesFired: a.hedgesFired + b.hedgesFired,
    hedgesWon: a.hedgesWon + b.hedgesWon
  };
}

// Seconds from an actor's first model.start to its last model.finish — for the
// advocates this spans the whole tool loop, not a single HTTP call.
function roleLatencies(run: Run | null): Partial<Record<AgentRole, number>> {
  const latencies: Partial<Record<AgentRole, number>> = {};
  if (run === null) return latencies;
  for (const actor of AGENT_ROLES) {
    const start = run.events.find(event => event.actor === actor && event.type === 'model.start');
    const finish = [...run.events].reverse().find(event => event.actor === actor && event.type === 'model.finish');
    if (start === undefined || finish === undefined) continue;
    const ms = Date.parse(finish.timestamp) - Date.parse(start.timestamp);
    if (Number.isFinite(ms) && ms >= 0) latencies[actor] = Math.round(ms / 100) / 10;
  }
  return latencies;
}

export function evaluateRun(raw: RawRun, facts: FixtureFacts): RunResult {
  const run = terminalRun(raw);
  const remedyMatch = checkRemedy(run, facts.expected);
  const amountExact = checkAmount(run, facts.expected);
  const checks: RunChecks = {
    statusMatch: checkStatus(run, facts.expected),
    remedyMatch,
    amountExact,
    citationsValid: checkCitations(run, facts),
    traceComplete: checkTrace(run, facts),
    noReasoningLeak: checkReasoningLeak(run),
    withinDeadline: checkDeadline(raw),
    riskSignalsIntact: checkRiskSignals(run, facts.expectedRisk),
    contextOnly: checkContextOnly(run, facts.expectedRisk, remedyMatch, amountExact),
    verdictMatch: checkVerdict(run, facts)
  };
  const completed = run !== null && run.status === 'completed' ? run : null;
  const passed = Object.values(checks).every(check => check.ok);
  return {
    fixtureId: raw.fixtureId,
    attempt: raw.attempt,
    runId: raw.runId,
    status: run !== null ? run.status : raw.problem?.code ?? raw.run?.status ?? 'unknown',
    remedyId: completed === null ? null : completed.result.action.remedyId,
    amountCents: completed === null ? null : completed.result.action.amountCents,
    latencyMs: raw.latencyMs,
    passed,
    checks,
    failureClass: passed ? null : classifyFailure(run, checks),
    roleLatencySec: roleLatencies(run),
    decisiveCoverage: decisiveCoverage(run, facts.expected),
    problem: raw.problem !== null ? `${raw.problem.code}: ${raw.problem.message}`
      : run !== null && run.status === 'failed' ? `${run.error.code}: ${run.error.message}` : null,
    escalated: completed !== null && completed.escalation !== undefined,
    escalationReasons: completed?.escalation?.reasons ?? [],
    divergent: completed !== null && completed.escalation !== undefined && completed.escalation.reasons.includes('policy_divergence'),
    undetermined: run !== null && run.verdict?.outcome === 'undetermined',
    retried: raw.retriedFrom !== null,
    wallMs: raw.wallMs,
    modelStats: mergeStats(
      raw.firstAttempt === null ? EMPTY_STATS : modelStatsFor(raw.firstAttempt),
      raw.run === null ? EMPTY_STATS : modelStatsFor(raw.run)
    ),
    riskOverall: raw.run?.risk?.overall ?? null
  };
}
