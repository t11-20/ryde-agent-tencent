import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import type { Run } from '@fairtrip/contracts';
import { createFixtureSource, loadDataset } from '@fairtrip/evidence';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { evaluateRun, executeRun, fixtureFacts, type RawRun, type RunChecks } from '../../packages/eval/src/index.js';
import { createScriptedModel } from './scripted-model.js';

const liveConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'scripted'});

type CompletedRun = Extract<Run, {status: 'completed'}>;
type CheckName = keyof RunChecks;

function completed(raw: RawRun): CompletedRun {
  if (raw.run === null || raw.run.status !== 'completed') throw new Error('expected a completed run');
  return raw.run;
}

function failingChecks(checks: RunChecks): CheckName[] {
  return (Object.keys(checks) as CheckName[]).filter(name => !checks[name].ok);
}

describe('eval checks against a real R1 run', () => {
  it('passes a real run and fails exactly the named check for each mutation', async () => {
    const server = createApp(liveConfig, createScriptedModel(), createFixtureSource()).listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const {port} = server.address() as AddressInfo;
      const raw = await executeRun('R1', 1, {baseUrl: `http://127.0.0.1:${port}`, pollMs: 20, timeoutSec: 20});
      const facts = fixtureFacts(loadDataset(), 'R1');

      const baseline = evaluateRun(raw, facts);
      expect(failingChecks(baseline.checks)).toEqual([]);
      expect(baseline.passed).toBe(true);
      expect(baseline.status).toBe('completed');

      const mutate = (change: (copy: RawRun) => void): CheckName[] => {
        const copy = structuredClone(raw);
        change(copy);
        return failingChecks(evaluateRun(copy, facts).checks);
      };

      expect(mutate(copy => { completed(copy).result.action.amountCents = 197; })).toEqual(['amountExact']);
      expect(mutate(copy => { completed(copy).result.reasoning = 'Because <think>x</think> so.'; })).toEqual(['noReasoningLeak']);
      expect(mutate(copy => { Object.assign(completed(copy).result, {reasoning_content: 'hidden'}); })).toEqual(['noReasoningLeak']);
      expect(mutate(copy => {
        const run = completed(copy);
        run.events = run.events.filter(event => event.type !== 'judge.started');
      })).toEqual(['traceComplete']);
      expect(mutate(copy => {
        const finding = completed(copy).result.findings[0];
        if (finding === undefined) throw new Error('no finding');
        finding.evidenceIds.push('GPS-FAKE');
      })).toEqual(['citationsValid']);
      expect(mutate(copy => { copy.latencyMs = 95000; })).toEqual(['withinDeadline']);
    } finally {
      server.close();
    }
  });
});
