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

      // 26 planned runs (20 fixtures with R1, N2 and R1F tripled) plus one feedback-probe N2 run.
      expect(report.runs).toHaveLength(27);
      for (const run of report.runs) expect({fixtureId: run.fixtureId, attempt: run.attempt, passed: run.passed}).toEqual({fixtureId: run.fixtureId, attempt: run.attempt, passed: true});
      expect(report.gate?.passed).toBe(true);

      const probeRuns = report.runs.filter(run => run.probe === 'feedback');
      expect(probeRuns).toHaveLength(1);
      expect(probeRuns[0]?.fixtureId).toBe('N2');
      expect(probeRuns[0]?.attempt).toBe(4);
      expect(probeRuns[0]?.feedbackPrecedent?.ok).toBe(true);
      expect(report.feedback?.problems).toEqual([]);
      expect(report.feedback?.overrideAmountCents).toBe(report.feedback?.expectedOverrideAmountCents);
      expect(report.metrics.feedbackProbe).toBe('pass');

      const verdictCondition = report.gate?.conditions.find(condition => condition.name === 'policy-verdict-authoritative');
      expect(verdictCondition?.ok).toBe(true);
      const finalised = report.runs.filter(run => run.status === 'completed' && !run.escalated).length;
      expect(report.metrics.verdictAgree).toBe(finalised);
      expect(report.metrics.divergentRuns).toBe(0);
      expect(report.metrics.undeterminedRuns).toBe(0);
      expect(report.metrics.providerRetries).toBe(0);

      const scorecard = join(outDir, 'scorecard.md');
      expect(existsSync(scorecard)).toBe(true);
      const markdown = readFileSync(scorecard, 'utf8');
      expect(markdown).toContain('Release gate: PASS');
      expect(markdown).toContain('human-review-feedback: PASS');
      expect(markdown).toContain('policy-verdict-authoritative: PASS');
      expect(markdown).toContain('N2 (feedback probe)');
      expect(existsSync(join(outDir, 'scorecard.json'))).toBe(true);
      expect(existsSync(join(outDir, 'runs', 'R1-3.json'))).toBe(true);
      expect(existsSync(join(outDir, 'runs', 'N2-4-feedback.json'))).toBe(true);
    } finally {
      server.close();
      rmSync(outDir, {recursive: true, force: true});
    }
  }, 60_000);
});
