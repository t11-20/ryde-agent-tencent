import type { Run } from '@fairtrip/contracts';
import { buildEvidence, findExpected, findFixture, policyClausesFor, type Dataset, type ExpectedOutcome } from '@fairtrip/evidence';
import type { RawRun } from './client.js';
import type { CheckResult, RunChecks, RunResult } from './report.js';

export interface FixtureFacts {
  expected: ExpectedOutcome; recordIds: string[]; familiesWithRecords: string[]; clauseIds: string[];
  /** Evidence ID → family, for every record of the fixture. */
  recordFamilies: Record<string, string>;
}

const DEADLINE_MS = 90_000;
const TERMINAL_STATUSES = new Set(['completed', 'incomplete', 'failed']);
const TERMINAL_EVENTS = new Set(['run.completed', 'run.incomplete', 'run.failed']);

export function fixtureFacts(dataset: Dataset, fixtureId: string): FixtureFacts {
  const fixture = findFixture(dataset, fixtureId);
  const expected = findExpected(dataset, fixtureId);
  if (fixture === undefined || expected === undefined) throw new Error(`Unknown fixture: ${fixtureId}`);
  const records = buildEvidence(fixture, dataset.policy).records;
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
    recordFamilies
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

function decisiveCoverage(run: Run | null, expected: ExpectedOutcome): number | null {
  if (expected.decisiveEvidenceIds.length === 0 || run === null || run.status !== 'completed') return null;
  const cited = new Set(run.result.findings.flatMap(finding => finding.evidenceIds));
  const hits = expected.decisiveEvidenceIds.filter(id => cited.has(id)).length;
  return hits / expected.decisiveEvidenceIds.length;
}

export function evaluateRun(raw: RawRun, facts: FixtureFacts): RunResult {
  const run = terminalRun(raw);
  const checks: RunChecks = {
    statusMatch: checkStatus(run, facts.expected),
    remedyMatch: checkRemedy(run, facts.expected),
    amountExact: checkAmount(run, facts.expected),
    citationsValid: checkCitations(run, facts),
    traceComplete: checkTrace(run, facts),
    noReasoningLeak: checkReasoningLeak(run),
    withinDeadline: checkDeadline(raw)
  };
  const completed = run !== null && run.status === 'completed' ? run : null;
  return {
    fixtureId: raw.fixtureId,
    attempt: raw.attempt,
    runId: raw.runId,
    status: run !== null ? run.status : raw.problem?.code ?? raw.run?.status ?? 'unknown',
    remedyId: completed === null ? null : completed.result.action.remedyId,
    amountCents: completed === null ? null : completed.result.action.amountCents,
    latencyMs: raw.latencyMs,
    passed: Object.values(checks).every(check => check.ok),
    checks,
    decisiveCoverage: decisiveCoverage(run, facts.expected),
    problem: raw.problem === null ? null : `${raw.problem.code}: ${raw.problem.message}`
  };
}
