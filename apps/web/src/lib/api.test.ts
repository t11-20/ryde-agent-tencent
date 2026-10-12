import { describe, expect, it } from 'vitest';
import { ContractMismatchError, NetworkError, fetchFixtures, fetchRun } from './api.js';
import { completedRun } from './test-runs.js';

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
});
