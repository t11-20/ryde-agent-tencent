import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildFinalAction, type CalculationProvider } from '@fairtrip/agents';
import type { Evidence, JudgeModelResponse } from '@fairtrip/contracts';
import {
  buildEvidence, calculateSurgedDistanceCapCents, checkFare, loadDataset, type Fixture,
} from '../src/index.js';

// Adversarial money-guardrail suite, class D: hostile mutations of payment facts
// and hostile calculation providers must never produce an invalid, negative,
// non-integer or over-paid refund. Deterministic mutation lists; no randomness.

const dataset = loadDataset();

type AvailablePayment = Extract<Fixture['payment'], {status: 'available'}>;
const payable = dataset.fixtures.filter((f): f is Fixture & {payment: AvailablePayment} => f.payment.status === 'available');

const remedyFactsSchema = z.object({
  basis: z.array(z.object({remedyId: z.string(), eligibleCents: z.number().nullable()})),
});
const fareFactsSchema = z.object({paidCents: z.number()});

function remedyBasisOf(fixture: Fixture) {
  const record = buildEvidence(fixture, dataset.policy).records.find(r => r.id === 'PAY-REMEDY');
  if (record === undefined) throw new Error('PAY-REMEDY record missing for a payment-available fixture');
  return remedyFactsSchema.parse(record.facts).basis;
}

function paidCapOf(evidence: Evidence[]): number {
  const record = evidence.find(r => r.id === 'PAY-FARE');
  return record === undefined ? 0 : fareFactsSchema.parse(record.facts).paidCents;
}

interface Mutation {
  name: string;
  apply: (payment: AvailablePayment) => void;
}

const mutations: Mutation[] = [
  ...[100, 150, 999, 10000].map(x => ({
    name: `surgeMultiplierX100 = ${x}`,
    apply: (payment: AvailablePayment) => {
      payment.surgeMultiplierX100 = x;
    },
  })),
  {name: 'paidCents = 0', apply: payment => {
    payment.paidCents = 0;
  }},
  {name: 'paidCents = 1', apply: payment => {
    payment.paidCents = 1;
  }},
  {name: 'paidCents = floor(total/2)', apply: payment => {
    payment.paidCents = Math.floor(payment.totalCents / 2);
  }},
  {name: 'paidCents = total', apply: payment => {
    payment.paidCents = payment.totalCents;
  }},
  {name: 'paidCents = total x10', apply: payment => {
    payment.paidCents = payment.totalCents * 10;
  }},
  {name: 'duplicate no_show_fee line item', apply: payment => {
    const item = payment.lineItems.find(li => li.code === 'no_show_fee');
    if (item !== undefined) payment.lineItems.push({...item});
  }},
  {name: 'promo of -2x total', apply: payment => {
    payment.lineItems.push({code: 'promo', label: 'Hostile promo', cents: -2 * payment.totalCents});
  }},
  {name: 'distance quantity x1000', apply: payment => {
    const item = payment.lineItems.find(li => li.code === 'distance');
    if (item !== undefined) item.quantity = (item.quantity ?? 0) * 1000;
  }},
  {name: 'remove distance item', apply: payment => {
    payment.lineItems = payment.lineItems.filter(li => li.code !== 'distance');
  }},
  {name: "currency = 'USD'", apply: payment => {
    payment.currency = 'USD';
  }},
];

describe('adversarial money invariants over mutated payment facts', () => {
  for (const fixture of payable) {
    describe(fixture.fixtureId, () => {
      for (const mutation of mutations) {
        it(`${mutation.name} keeps every basis entry valid, capped and consistent`, () => {
          const clone = structuredClone(fixture);
          mutation.apply(clone.payment);
          const basis = remedyBasisOf(clone);
          const fare = checkFare(clone.payment);
          const paidCents = clone.payment.paidCents;
          const noShowSum = clone.payment.lineItems.reduce((sum, li) => (li.code === 'no_show_fee' ? sum + li.cents : sum), 0);
          const distanceCents = clone.payment.lineItems.reduce((sum, li) => (li.code === 'distance' ? sum + li.cents : sum), 0);
          const surgedCap = calculateSurgedDistanceCapCents(distanceCents, clone.payment.surgeMultiplierX100);

          for (const entry of basis) {
            if (entry.remedyId === 'keep_charge') {
              expect(entry.eligibleCents).toBe(0);
              continue;
            }
            if (entry.eligibleCents !== null) {
              expect(Number.isInteger(entry.eligibleCents)).toBe(true);
              expect(entry.eligibleCents).toBeGreaterThanOrEqual(0);
              expect(entry.eligibleCents).toBeLessThanOrEqual(paidCents);
              if (entry.remedyId === 'refund_no_show_fee') expect(entry.eligibleCents).toBeLessThanOrEqual(noShowSum);
              if (entry.remedyId === 'refund_route_excess') expect(entry.eligibleCents).toBeLessThanOrEqual(surgedCap);
            }
          }
          // Any fare anomaly must disable both refunds entirely.
          if (fare.anomalies.length > 0) {
            for (const entry of basis.filter(e => e.remedyId !== 'keep_charge')) {
              expect(entry.eligibleCents).toBeNull();
            }
          }
        });
      }
    });
  }
});

describe('adversarial calculation providers', () => {
  const response: JudgeModelResponse = {
    ruling: 'rider_favored',
    findings: [{claim: 'Test finding', evidenceIds: [], policyClauseIds: []}],
    remedyId: 'refund_route_excess',
    confidence: 0.9,
    reasoning: 'Adversarial provider test.',
    riderExplanation: 'Test.',
    driverExplanation: 'Test.',
  };
  const evidence = buildEvidence(dataset.fixtures.find(f => f.fixtureId === 'R1') as Fixture, dataset.policy).records;
  const paidCap = paidCapOf(evidence);
  const hostile = (amountCents: number): CalculationProvider => ({
    calculateRouteExcess: () => ({amountCents, eligible: true}),
    getNoShowFee: () => ({amountCents, eligible: true}),
    getPaidChargeCap: () => paidCap,
  });

  // Non-finite and non-integer provider amounts are rejected before the cap.
  it.each([-5, NaN, Infinity, 12.5])('a provider returning amountCents %s produces an error and a zero action', amountCents => {
    const {action, error} = buildFinalAction(response, evidence, hostile(amountCents), 'route_deviation');
    expect(error).toBeDefined();
    expect(action.amountCents).toBe(0);
  });

  // A finite overshoot is clamped by the paid-charge cap — the cap is the guard.
  it.each([1_000_000, 1e12])('a provider returning eligible %s is capped at what the rider paid', amountCents => {
    const {action, error} = buildFinalAction(response, evidence, hostile(amountCents), 'route_deviation');
    expect(error).toBeUndefined();
    expect(action.amountCents).toBe(paidCap);
  });

  it('keep_charge is always zero regardless of a hostile provider', () => {
    const {action, error} = buildFinalAction({...response, remedyId: 'keep_charge'}, evidence, hostile(1e12), 'route_deviation');
    expect(error).toBeUndefined();
    expect(action.amountCents).toBe(0);
    expect(action.recipient).toBe('none');
  });
});
