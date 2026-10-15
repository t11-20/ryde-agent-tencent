import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { RunSchema, type Run } from '@fairtrip/contracts';
import {
  buildEvidence, createFixtureSource, findFixture, loadDataset,
  type ExpectedOutcome, type Fixture
} from '@fairtrip/evidence';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { createScriptedModel } from './scripted-model.js';

// LB-10 golden flow: every fixture must produce its expected outcome through the
// real backend (tools, evidence, policy, guard, money, trace) with the scripted
// model (SPEC §10). No network, no hand-computed numbers: all expectations come
// from loadDataset().expected and buildEvidence.

const liveConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'scripted'});
const app = () => createApp(liveConfig, createScriptedModel(), createFixtureSource());

async function terminalRun(api: ReturnType<typeof app>, id: string): Promise<Run> {
  for (let poll = 0; poll < 400; poll++) {
    const response = await request(api).get(`/api/runs/${id}`);
    const status: unknown = response.body.status;
    if (status === 'completed' || status === 'failed' || status === 'incomplete') return RunSchema.parse(response.body);
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('Run did not reach a terminal status within 400 polls');
}

async function runFixture(fixtureId: string): Promise<Run> {
  const api = app();
  const started = await request(api).post('/api/runs').send({fixtureId});
  expect(started.status).toBe(202);
  return terminalRun(api, String(started.body.id));
}

const dataset = loadDataset();

function fixtureFor(expected: ExpectedOutcome): Fixture {
  const fixture = findFixture(dataset, expected.fixtureId);
  if (fixture === undefined) throw new Error(`No fixture for expected outcome ${expected.fixtureId}`);
  return fixture;
}

/** Trace shape: both advocates fully active, judge after both cases, terminal event last. */
function expectTrace(run: Run, fixture: Fixture): void {
  const judgeStarted = run.events.findIndex(event => event.type === 'judge.started');
  expect(judgeStarted).toBeGreaterThanOrEqual(0);
  for (const side of ['rider', 'driver'] as const) {
    const events = run.events.filter(event => event.actor === side);
    expect(events.some(event => event.type === 'tool.requested')).toBe(true);
    expect(events.some(event => event.type === 'evidence.retrieved')).toBe(true);
    expect(events.some(event => event.type === 'policy.retrieved')).toBe(true);
    expect(events.filter(event => event.type === 'case.completed')).toHaveLength(1);
    const caseCompleted = run.events.findIndex(event => event.actor === side && event.type === 'case.completed');
    expect(judgeStarted).toBeGreaterThan(caseCompleted);
  }
  const last = run.events[run.events.length - 1];
  expect(last?.type === 'run.completed' || last?.type === 'run.incomplete').toBe(true);

  // The IDs in all evidence.retrieved events cover every family that has records.
  const records = buildEvidence(fixture, dataset.policy).records;
  const familyById = new Map(records.map(record => [record.id, record.source]));
  const coveredFamilies = new Set<string>();
  for (const event of run.events) {
    if (event.type !== 'evidence.retrieved') continue;
    for (const id of event.evidenceIds) {
      const family = familyById.get(id);
      if (family !== undefined) coveredFamilies.add(family);
    }
  }
  for (const record of records) expect(coveredFamilies.has(record.source)).toBe(true);
}

/** Every cited evidence ID (both cases and, when completed, the Judge findings) is a fixture record ID. */
function expectCitations(run: Run, fixture: Fixture): void {
  const recordIds = new Set(buildEvidence(fixture, dataset.policy).records.map(record => record.id));
  const citedIds: string[] = [];
  for (const advocateCase of run.cases) {
    for (const argument of [...advocateCase.arguments, ...advocateCase.counterevidence]) citedIds.push(...argument.evidenceIds);
  }
  if (run.status === 'completed') {
    for (const finding of run.result.findings) citedIds.push(...finding.evidenceIds);
  }
  for (const id of citedIds) expect(recordIds.has(id)).toBe(true);
}

describe.each(dataset.expected)('golden flow $fixtureId', (expected) => {
  it('produces the expected outcome through the real workflow', async () => {
    const fixture = fixtureFor(expected);
    const run = await runFixture(expected.fixtureId);
    expect(run.fixtureId).toBe(expected.fixtureId);
    expect(run.status).toBe(expected.expectedStatus);

    // Every terminal live run carries the deterministic policy verdict, and an
    // unescalated completed run can never diverge from it.
    expect(run.verdict).toBeDefined();
    expect(run.events.some(e => e.type === 'verdict.computed')).toBe(true);

    if (run.status === 'completed') {
      expect(run.result.action.remedyId).toBe(expected.expectedRemedyId);
      expect(run.result.action.amountCents).toBe(expected.expectedAmountCents);
      expect(run.verdict?.outcome).toBe(expected.expectedRemedyId);
      if (run.escalation === undefined) expect(run.divergence).toBeUndefined();
    } else if (run.status === 'incomplete') {
      expect('result' in run).toBe(false);
      expect(run.verdict?.outcome).toBe('incomplete');
      const firstFamily = expected.missingFamilies[0];
      if (firstFamily === undefined) throw new Error(`Expected outcome ${expected.fixtureId} is incomplete without missingFamilies`);
      expect(run.missingEvidence[0]?.startsWith(`${firstFamily}:`)).toBe(true);
    }

    expectTrace(run, fixture);
    expectCitations(run, fixture);
  });
});

describe('escalation with the scripted model', () => {
  it.each(['R1F', 'N1R', 'X6'])('%s completes with a high_risk escalation and the expected outcome', async (fixtureId) => {
    const expected = dataset.expected.find(e => e.fixtureId === fixtureId);
    if (expected === undefined) throw new Error(`No expected outcome for ${fixtureId}`);
    const run = await runFixture(fixtureId);
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.escalation?.reasons).toContain('high_risk');
    expect(run.result.action.remedyId).toBe(expected.expectedRemedyId);
    expect(run.result.action.amountCents).toBe(expected.expectedAmountCents);
  });

  it.each(['N5', 'R4'])('%s completes without an escalation', async (fixtureId) => {
    const run = await runFixture(fixtureId);
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.escalation).toBeUndefined();
  });
});
