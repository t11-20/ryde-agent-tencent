import request from 'supertest';
import { expect } from 'vitest';
import { z } from 'zod';
import { RunSchema, type Run } from '@fairtrip/contracts';
import type { DisputeSource, ModelAdapter } from '@fairtrip/agents';
import { createFixtureSource } from '@fairtrip/evidence';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig, type Config } from '../../apps/api/src/config.js';
import { createScriptedModel } from '../integration/scripted-model.js';

// Shared plumbing for the adversarial guardrail suite. Every hostile adapter
// wraps the deterministic scripted model and mutates one role's JSON output on
// the wire, so the real workflow, tools, evidence and money all stay in play.

export const liveConfig = (extra: Record<string, string> = {}): Config =>
  readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'scripted', ...extra});

export const app = (config: Config = liveConfig(), model?: ModelAdapter, source?: DisputeSource) =>
  createApp(config, model ?? createScriptedModel(), source ?? createFixtureSource());

export async function terminalRun(api: ReturnType<typeof app>, id: string): Promise<Run> {
  for (let poll = 0; poll < 400; poll++) {
    const response = await request(api).get(`/api/runs/${id}`);
    const status: unknown = response.body.status;
    if (status === 'completed' || status === 'failed' || status === 'incomplete') return RunSchema.parse(response.body);
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('Run did not reach a terminal status within 400 polls');
}

export async function runFixture(api: ReturnType<typeof app>, fixtureId: string, riderClaim?: string): Promise<Run> {
  const started = await request(api).post('/api/runs').send(riderClaim === undefined ? {fixtureId} : {fixtureId, riderClaim});
  expect(started.status).toBe(202);
  return terminalRun(api, String(started.body.id));
}

const basisSchema = z.array(z.object({remedyId: z.string(), eligibleCents: z.number().int().nullable()}));

/** The server-computed eligible cents for a remedy, read from the run's PAY-REMEDY record. */
export function eligibleCentsFor(run: Run, remedyId: string): number {
  const record = run.retrievedEvidence.find(item => item.id === 'PAY-REMEDY');
  if (record === undefined) throw new Error('PAY-REMEDY record not retrieved');
  const basis = basisSchema.parse(z.object({basis: z.unknown()}).parse(record.facts).basis);
  const entry = basis.find(item => item.remedyId === remedyId);
  if (entry === undefined || entry.eligibleCents === null) throw new Error(`No eligible amount for ${remedyId}`);
  return entry.eligibleCents;
}

export type HostileRole = 'rider' | 'driver' | 'judge' | 'risk';

function roleOfPrompt(system: string): HostileRole | undefined {
  if (system.startsWith('You are the Risk Analyst')) return 'risk';
  if (system.startsWith('You are the Rider Advocate')) return 'rider';
  if (system.startsWith('You are the Driver Advocate')) return 'driver';
  if (system.startsWith('You are the Judge')) return 'judge';
  return undefined;
}

export interface JsonObject {
  [key: string]: unknown;
}

/**
 * A hostile model adapter: every call goes to the scripted model, then `mutate`
 * receives the parsed JSON output of each role plus the 1-based call index for
 * that role and may rewrite it in place before it goes back on the wire.
 * Advocate outputs are the tool-loop envelopes ({type:'tool_request'|..., case}).
 */
export function hostileModel(mutate: (role: HostileRole, output: JsonObject, callIndex: number) => void): ModelAdapter {
  const inner = createScriptedModel();
  const counts: Record<HostileRole, number> = {rider: 0, driver: 0, judge: 0, risk: 0};
  return {
    async complete(messages, signal) {
      const raw = await inner.complete(messages, signal);
      const role = roleOfPrompt(messages[0]?.content ?? '');
      if (role === undefined) return raw;
      counts[role] += 1;
      const parsed = JSON.parse(raw) as JsonObject;
      mutate(role, parsed, counts[role]);
      return JSON.stringify(parsed);
    }
  };
}
