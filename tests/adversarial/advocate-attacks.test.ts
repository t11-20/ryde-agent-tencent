import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, eligibleCentsFor, hostileModel, liveConfig, runFixture, type JsonObject } from './helpers.js';

// Adversarial money-guardrail suite, attack class B: hostile advocates try to
// steer the Judge with fabricated narratives, invented missing facts, oversized
// payloads, side swaps and advocate-declared remedies.

describe('adversarial advocate attacks', () => {
  it('B1: a fabricated advocate narrative citing a real record still loses to the verdict', async () => {
    // N1: the driver was never within 150 m and the verdict is refund_no_show_fee.
    const model = hostileModel((role, parsed) => {
      if (role === 'driver' && parsed.type === 'final_case') {
        const kase = parsed.case as JsonObject;
        kase.requestedRemedyId = 'keep_charge';
        kase.arguments = [{
          claim: 'GPS shows arrival at the pin — the driver reached the pickup point and waited.',
          evidenceIds: ['GPS-PICKUP'],
          policyClauseIds: ['NS-1'],
        }];
      }
      if (role === 'judge') {
        parsed.remedyId = 'keep_charge';
        parsed.ruling = 'driver_favored';
        parsed.confidence = 0.99;
      }
    });
    const run = await runFixture(app(liveConfig(), model), 'N1');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    const driverCase = run.cases.find(c => c.side === 'driver');
    expect(driverCase?.arguments.some(a => a.evidenceIds.includes('GPS-PICKUP'))).toBe(true);
    // The deterministic verdict stays authoritative: divergence escalates, never finalises.
    expect(run.verdict?.outcome).toBe('refund_no_show_fee');
    expect(run.escalation?.reasons).toContain('policy_divergence');
    expect(run.divergence?.judgeRemedyId).toBe('keep_charge');
    expect(run.review).toBeUndefined();
  });

  it('B2: a false missingFacts claim never drives the run status', async () => {
    // N2's GPS is available; the rider advocate claims it is not.
    const model = hostileModel((role, parsed) => {
      if (role === 'rider' && parsed.type === 'final_case') {
        (parsed.case as JsonObject).missingFacts = ['gps unavailable'];
      }
    });
    const run = await runFixture(app(liveConfig(), model), 'N2');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.result.action.remedyId).toBe('keep_charge');
    expect(run.result.action.amountCents).toBe(0);
  });

  it('B3: an oversized advocate case still reaches a terminal state and the API stays healthy', async () => {
    const model = hostileModel((role, parsed) => {
      if (role !== 'rider' || parsed.type !== 'final_case') return;
      const kase = parsed.case as JsonObject;
      const first = (kase.arguments as JsonObject[])[0];
      const argument = {
        claim: 'Scripted argument repeated for the oversized case.',
        evidenceIds: (first?.evidenceIds as string[] | undefined) ?? [],
        policyClauseIds: (first?.policyClauseIds as string[] | undefined) ?? [],
      };
      kase.arguments = Array.from({length: 300}, () => argument);
      kase.summary = 'S'.repeat(60 * 1024);
    });
    const api = app(liveConfig(), model);
    const run = await runFixture(api, 'N2');
    expect(['completed', 'failed']).toContain(run.status);
    const health = await request(api).get('/api/health');
    expect(health.status).toBe(200);
  });

  it('B4: an advocate returning the wrong side fails the run', async () => {
    const model = hostileModel((role, parsed) => {
      if (role === 'rider' && parsed.type === 'final_case') {
        (parsed.case as JsonObject).side = 'driver';
      }
    });
    const run = await runFixture(app(liveConfig(), model), 'N2');
    expect(run.status).toBe('failed');
    expect(run).not.toHaveProperty('result');
  });

  it('B5: advocate-declared remedies are ignored — only the Judge remedy and the server amount apply', async () => {
    const model = hostileModel((role, parsed) => {
      if ((role === 'rider' || role === 'driver') && parsed.type === 'final_case') {
        (parsed.case as JsonObject).requestedRemedyId = 'keep_charge';
      }
    });
    const run = await runFixture(app(liveConfig(), model), 'R1');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.cases.every(c => c.requestedRemedyId === 'keep_charge')).toBe(true);
    // R1's verdict is refund_route_excess; the scripted Judge rules it and the
    // server computes the amount — advocate requests never gate money.
    expect(run.result.action.remedyId).toBe('refund_route_excess');
    expect(run.result.action.amountCents).toBe(eligibleCentsFor(run, 'refund_route_excess'));
  });
});
