import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFixtureSource } from '@fairtrip/evidence';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { runEval } from '../../packages/eval/src/index.js';
import { createScriptedModel } from './scripted-model.js';

const liveConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'scripted'});

describe('eval runner end to end with the scripted model', () => {
  it('passes the release gate and writes the scorecard', async () => {
    const server = createApp(liveConfig, createScriptedModel(), createFixtureSource()).listen(0, '127.0.0.1');
    const outDir = mkdtempSync(join(tmpdir(), 'fairtrip-eval-'));
    try {
      await once(server, 'listening');
      const {port} = server.address() as AddressInfo;
      const report = await runEval({baseUrl: `http://127.0.0.1:${port}`, fixtures: 'release', repeat: 1, pollMs: 20, timeoutSec: 30, releaseGate: true, outDir});

      expect(report.runs).toHaveLength(15);
      for (const run of report.runs) expect({fixtureId: run.fixtureId, attempt: run.attempt, passed: run.passed}).toEqual({fixtureId: run.fixtureId, attempt: run.attempt, passed: true});
      expect(report.gate?.passed).toBe(true);

      const scorecard = join(outDir, 'scorecard.md');
      expect(existsSync(scorecard)).toBe(true);
      expect(readFileSync(scorecard, 'utf8')).toContain('Release gate: PASS');
      expect(existsSync(join(outDir, 'scorecard.json'))).toBe(true);
      expect(existsSync(join(outDir, 'runs', 'R1-3.json'))).toBe(true);
    } finally {
      server.close();
      rmSync(outDir, {recursive: true, force: true});
    }
  }, 60_000);
});
