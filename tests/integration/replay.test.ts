import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { RunSchema, type Run } from '@fairtrip/contracts';
import { createFixtureSource } from '@fairtrip/evidence';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig, type Config } from '../../apps/api/src/config.js';
import { loadReplays, replaySourceName } from '../../apps/api/src/replay.js';

// Replay mode serves recorded eval runs without a model adapter or credentials.
const replayConfig = (extra: Record<string, string> = {}): Config =>
  readConfig({RUN_MODE: 'replay', REPLAY_SPEED: '1000', ...extra});
const app = (config: Config = replayConfig()) => createApp(config, undefined, createFixtureSource());

async function terminalRun(api: ReturnType<typeof app>, id: string): Promise<Run> {
  for (let poll = 0; poll < 400; poll++) {
    const response = await request(api).get(`/api/runs/${id}`);
    expect(RunSchema.safeParse(response.body).success).toBe(true);
    const status: unknown = response.body.status;
    if (status === 'completed' || status === 'failed' || status === 'incomplete') return RunSchema.parse(response.body);
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('Replay run did not reach a terminal status within 400 polls');
}

async function runFixture(api: ReturnType<typeof app>, fixtureId: string): Promise<Run> {
  const started = await request(api).post('/api/runs').send({fixtureId});
  expect(started.status).toBe(202);
  expect(started.body.mode).toBe('replay');
  return terminalRun(api, String(started.body.id));
}

describe('replay mode', () => {
  it('loads the recorded release-gate runs and rejects bad or failed records', () => {
    const replays = loadReplays('apps/api/replays/20261013-144417');
    expect(replays.size).toBe(20);
    expect(replaySourceName('apps/api/replays/20261013-144417')).toBe('20261013-144417');
    const r1 = replays.get('R1');
    expect(r1?.run.status).toBe('completed');
    expect(r1?.recordedAt).toBe(r1?.run.events[0]?.timestamp);
    expect(() => loadReplays('apps/api/replays/does-not-exist')).toThrow('Replay directory');
  });

  it('boots without model config, reports replay health and lists only recorded fixtures', async () => {
    const api = app();
    const health = await request(api).get('/api/health');
    expect(health.body.mode).toBe('replay');
    expect(health.body.contractVersion).toBe('0.3.3');
    expect(health.body.modelAccess).toBe('not_used_replay');
    expect(health.body.replay).toEqual({sourceEvalRun: '20261013-144417', speed: 1000, fixtures: 20});

    const list = await request(api).get('/api/fixtures');
    expect(list.status).toBe(200);
    expect(list.body.mode).toBe('replay');
    expect(list.body.fixtures).toHaveLength(20);
    expect(list.body.fixtures[0].id).toBe('R1');

    const unknown = await request(api).post('/api/runs').send({fixtureId: 'NOPE'});
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('UNKNOWN_FIXTURE');
  });

  it('replays R1 events in order with recorded summaries and the recorded outcome', async () => {
    const api = app();
    const run = await runFixture(api, 'R1');
    const recorded = loadReplays('apps/api/replays/20261013-144417').get('R1')!.run;

    expect(run.status).toBe('completed');
    expect(run.mode).toBe('replay');
    expect(run.id).not.toBe(recorded.id);
    expect(run.replay?.sourceRunId).toBe(recorded.id);
    expect(run.replay?.sourceEvalRun).toBe('20261013-144417');
    expect(run.replay?.speed).toBe(1000);
    if (run.status !== 'completed' || recorded.status !== 'completed') throw new Error('unreachable');
    expect(run.result.action.remedyId).toBe(recorded.result.action.remedyId);
    expect(run.result.action.amountCents).toBe(recorded.result.action.amountCents);
    expect(run.cases.map(c => c.side).sort()).toEqual(['driver', 'rider']);

    // The verdict is recomputed against the fixture source; it agrees with the
    // recorded R1 outcome so the replay is not escalated for divergence.
    expect(run.verdict?.outcome).toBe('refund_route_excess');
    expect(run.divergence).toBeUndefined();
    const verdictEvent = run.events.find(e => e.type === 'verdict.computed');
    expect(verdictEvent?.actor).toBe('system');
    expect(verdictEvent?.summary).toContain('refund_route_excess');

    // Events arrive re-stamped: same types/summaries in order after the
    // verdict.computed prologue, new run id and sequences.
    const replayed = run.events.filter(e => e.type !== 'verdict.computed');
    expect(replayed.map(e => e.type)).toEqual(recorded.events.map(e => e.type));
    expect(replayed.map(e => e.summary)).toEqual(recorded.events.map(e => e.summary));
    expect(run.events.map(e => e.sequence)).toEqual(run.events.map((_e, i) => i + 1));
    for (const event of run.events) {
      expect(event.runId).toBe(run.id);
      expect(event.mode).toBe('replay');
    }
    expect(run.retrievedEvidence.map(e => e.id)).toEqual(recorded.retrievedEvidence.map(e => e.id));
    expect(run.retrievedPolicies.map(p => p.id)).toEqual(recorded.retrievedPolicies.map(p => p.id));
  });

  it('replays an escalated N2H, allows a real override, and feeds the precedent to a later N2 replay', async () => {
    const api = app();
    const n2h = await runFixture(api, 'N2H');
    expect(n2h.status).toBe('completed');
    if (n2h.status !== 'completed') throw new Error('unreachable');
    expect(n2h.escalation?.reasons).toContain('high_risk');
    expect(n2h.escalation?.threshold).toBe(0.8);
    expect(n2h.risk?.overall).toBe('high');

    const reviewed = await request(api).post(`/api/runs/${n2h.id}/review`).send({decision: 'overridden', remedyId: 'refund_no_show_fee', note: 'Replay override probe'});
    expect(reviewed.status).toBe(200);
    const updated = RunSchema.parse(reviewed.body);
    if (updated.status !== 'completed' || updated.review === undefined) throw new Error('unreachable');
    expect(updated.review.decision).toBe('overridden');
    expect(updated.review.action.remedyId).toBe('refund_no_show_fee');
    expect(updated.review.action.amountCents).toBe(500);

    const n2 = await runFixture(api, 'N2');
    expect(n2.status).toBe('completed');
    expect(n2.precedents?.some(p => p.origin === 'human_override' && p.runId === n2h.id)).toBe(true);
    if (n2.status !== 'completed') throw new Error('unreachable');
    expect(n2.result.action.remedyId).toBe('keep_charge');
    expect(n2.result.action.amountCents).toBe(0);
  });

  it('lists runs newest first with remedy, amount and escalation flags', async () => {
    const api = app();
    const first = await runFixture(api, 'R1');
    const second = await runFixture(api, 'N2H');
    const list = await request(api).get('/api/runs');
    expect(list.status).toBe(200);
    const items = list.body.runs as {id: string; fixtureId: string; mode: string; status: string; createdAt: string; remedyId: string | null; amountCents: number | null; escalated: boolean}[];
    expect(items.length).toBe(2);
    expect(items[0]?.id).toBe(second.id);
    expect(items[1]?.id).toBe(first.id);
    expect(items[0]).toMatchObject({fixtureId: 'N2H', mode: 'replay', status: 'completed', remedyId: 'keep_charge', amountCents: 0, escalated: true});
    expect(items[1]).toMatchObject({fixtureId: 'R1', mode: 'replay', escalated: false});
    for (const item of items) expect(item.createdAt).not.toBe('');
  });

  it('replays an incomplete X5 with its recorded missing evidence', async () => {
    const api = app();
    const run = await runFixture(api, 'X5');
    expect(run.status).toBe('incomplete');
    if (run.status !== 'incomplete') throw new Error('unreachable');
    expect(run.missingEvidence.join(' ')).toContain('gps');
    expect(run.events.at(-1)?.type).toBe('run.incomplete');
  });
});
