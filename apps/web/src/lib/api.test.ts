import { describe, expect, it } from 'vitest';
import { ContractMismatchError, NetworkError, fetchFixtures, fetchHealth, fetchRun, listRuns, nextRunId } from './api.js';
import { completedRun, failedRun } from './test-runs.js';

const fakeFetch = (body: unknown, status = 200): typeof fetch =>
  async () => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

describe('fetchRun', () => {
  it('accepts a valid completed run', async () => {
    const run = await fetchRun('run-1', 0, fakeFetch(completedRun()));
    expect(run.id).toBe('run-1');
    expect(run.status).toBe('completed');
  });
  it('turns a bad body into ContractMismatchError', async () => {
    await expect(fetchRun('run-1', 0, fakeFetch({status: 'completed'}))).rejects.toThrow(ContractMismatchError);
  });
  it('turns HTTP 500 into NetworkError', async () => {
    await expect(fetchRun('run-1', 0, fakeFetch({}, 500))).rejects.toThrow(NetworkError);
  });
});

describe('fetchFixtures', () => {
  it('accepts a stub-mode listing', async () => {
    const body = {mode: 'stub', notice: 'n', fixtures: [{id: 'x', category: 'no_show', label: 'l', kind: 'contract_example'}]};
    const response = await fetchFixtures(fakeFetch(body));
    expect(response.fixtures[0]?.id).toBe('x');
  });
  it('accepts a replay-mode listing', async () => {
    const body = {mode: 'replay', notice: 'n', fixtures: [{id: 'R1', category: 'route_deviation', label: 'l', kind: 'fixture'}]};
    const response = await fetchFixtures(fakeFetch(body));
    expect(response.mode).toBe('replay');
    expect(response.fixtures[0]?.id).toBe('R1');
  });
});

describe('fetchHealth', () => {
  it('accepts a replay-mode health response', async () => {
    const body = {status: 'ok', mode: 'replay', contractVersion: '0.3.2', modelAccess: 'not_used_replay', replay: {sourceEvalRun: '20261013-144417', speed: 20, fixtures: 20}};
    const health = await fetchHealth(fakeFetch(body));
    expect(health.mode).toBe('replay');
    expect(health.replay?.sourceEvalRun).toBe('20261013-144417');
  });
});

describe('listRuns', () => {
  it('parses the run list newest first', async () => {
    const body = {runs: [
      {id: 'b', fixtureId: 'N2H', mode: 'replay', status: 'completed', createdAt: '2026-10-13T14:45:00Z', remedyId: 'keep_charge', amountCents: 0, escalated: true},
      {id: 'a', fixtureId: 'R1', mode: 'replay', status: 'completed', createdAt: '2026-10-13T14:44:00Z', remedyId: 'refund_route_excess', amountCents: 198, escalated: false}
    ]};
    const runs = await listRuns(fakeFetch(body));
    expect(runs.map(r => r.id)).toEqual(['b', 'a']);
    expect(runs[0]?.escalated).toBe(true);
    expect(runs[0]?.remedyId).toBe('keep_charge');
  });
  it('rejects a malformed list', async () => {
    await expect(listRuns(fakeFetch({runs: 'nope'}))).rejects.toThrow(ContractMismatchError);
  });
  it('parses retryOf on a re-run list item', async () => {
    const body = {runs: [
      {id: 'run-2', fixtureId: 'R1', mode: 'live', status: 'completed', createdAt: '2026-10-14T01:50:00Z', remedyId: 'keep_charge', amountCents: 0, escalated: false, retryOf: 'run-1'},
    ]};
    const runs = await listRuns(fakeFetch(body));
    expect(runs[0]?.retryOf).toBe('run-1');
  });
});

describe('nextRunId', () => {
  it('follows retriedBy on a failed first attempt only', () => {
    expect(nextRunId({...failedRun(), retriedBy: 'run-2'})).toBe('run-2');
    expect(nextRunId(failedRun())).toBeNull();
    expect(nextRunId({...completedRun(), retriedBy: 'run-2'})).toBeNull();
  });
});
