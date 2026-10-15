import { describe, it, expect } from 'vitest';
import { buildFinalAction, createMockCalculationProvider, type CalculationProvider } from '@fairtrip/agents';
import { FinalActionSchema } from '@fairtrip/contracts';
import type { JudgeModelResponse, Evidence } from '@fairtrip/contracts';

const calculationProvider = createMockCalculationProvider();

function modelResponse(remedyId: JudgeModelResponse['remedyId']): JudgeModelResponse {
  return {
    ruling: remedyId === 'keep_charge' ? 'incomplete' : 'rider_favored',
    findings: [{claim: 'Test finding', evidenceIds: ['e-1'], policyClauseIds: ['p-1']}],
    remedyId,
    confidence: 0.8,
    reasoning: 'Test reasoning',
    riderExplanation: 'Test rider explanation',
    driverExplanation: 'Test driver explanation'
  };
}

const routeEvidence: Evidence[] = [
  {id: 'e-route-gps-1', source: 'gps', timestamp: '2026-10-08T00:00:00Z', facts: {actualDistanceMeters: 3200, referenceDistanceMeters: 2800}, provenance: {kind: 'contract_example', description: 'Test'}},
  {id: 'e-route-payment-1', source: 'payment', timestamp: '2026-10-08T00:00:00Z', facts: {totalPaidCents: 770, cancellationFeeCents: 0}, provenance: {kind: 'contract_example', description: 'Test'}}
];

const noShowEvidence: Evidence[] = [
  {id: 'e-noshow-gps-1', source: 'gps', timestamp: '2026-10-08T00:00:00Z', facts: {pickupProximityMeters: 120, waitingSeconds: 360}, provenance: {kind: 'contract_example', description: 'Test'}},
  {id: 'e-noshow-payment-1', source: 'payment', timestamp: '2026-10-08T00:00:00Z', facts: {totalPaidCents: 500, cancellationFeeCents: 500}, provenance: {kind: 'contract_example', description: 'Test'}}
];

describe('remedy validation and FinalAction construction', () => {
  it('uses the dispute category for partner evidence IDs without example prefixes', () => {
    const evidence = noShowEvidence.map((record, index) => ({...record, id: `partner-evidence-${index}`}));
    const {action, error} = buildFinalAction(modelResponse('refund_no_show_fee'), evidence, calculationProvider, 'no_show');
    expect(error).toBeUndefined();
    expect(action.amountCents).toBe(500);
  });

  it('rejects the wrong remedy using the authoritative category even with misleading IDs', () => {
    const {error} = buildFinalAction(modelResponse('refund_no_show_fee'), noShowEvidence, calculationProvider, 'route_deviation');
    expect(error?.code).toBe('WRONG_CATEGORY_REMEDY');
  });

  it('constructs keep_charge with zero amount and no recipient', () => {
    const {action, error} = buildFinalAction(modelResponse('keep_charge'), routeEvidence, calculationProvider);
    expect(error).toBeUndefined();
    expect(action.remedyId).toBe('keep_charge');
    expect(action.amountCents).toBe(0);
    expect(action.recipient).toBe('none');
    expect(FinalActionSchema.safeParse(action).success).toBe(true);
  });

  it('rejects wrong-category remedy: refund_no_show_fee for route_deviation', () => {
    const {action, error} = buildFinalAction(modelResponse('refund_no_show_fee'), routeEvidence, calculationProvider);
    expect(error).toBeDefined();
    expect(error?.code).toBe('WRONG_CATEGORY_REMEDY');
    expect(action.remedyId).toBe('keep_charge');
    expect(action.amountCents).toBe(0);
  });

  it('rejects wrong-category remedy: refund_route_excess for no_show', () => {
    const {action, error} = buildFinalAction(modelResponse('refund_route_excess'), noShowEvidence, calculationProvider);
    expect(error).toBeDefined();
    expect(error?.code).toBe('WRONG_CATEGORY_REMEDY');
    expect(action.amountCents).toBe(0);
  });

  it('calculates refund_route_excess with paid-charge cap', () => {
    const {action, error} = buildFinalAction(modelResponse('refund_route_excess'), routeEvidence, calculationProvider);
    expect(error).toBeUndefined();
    expect(action.remedyId).toBe('refund_route_excess');
    expect(action.recipient).toBe('rider');
    expect(action.amountCents).toBeGreaterThan(0);
    expect(action.amountCents).toBeLessThanOrEqual(770); // paid charge cap
    expect(FinalActionSchema.safeParse(action).success).toBe(true);
  });

  it('calculates refund_no_show_fee from cancellation fee', () => {
    const {action, error} = buildFinalAction(modelResponse('refund_no_show_fee'), noShowEvidence, calculationProvider);
    expect(error).toBeUndefined();
    expect(action.remedyId).toBe('refund_no_show_fee');
    expect(action.recipient).toBe('rider');
    expect(action.amountCents).toBe(500); // cancellation fee from mock evidence
    expect(FinalActionSchema.safeParse(action).success).toBe(true);
  });

  it('caps refund at paid charge amount', () => {
    // Create evidence with very high cancellation fee but low total paid
    const limitedEvidence: Evidence[] = [
      {id: 'e-noshow-payment-1', source: 'payment', timestamp: '2026-10-08T00:00:00Z', facts: {totalPaidCents: 100, cancellationFeeCents: 500}, provenance: {kind: 'contract_example', description: 'Test'}}
    ];
    const {action, error} = buildFinalAction(modelResponse('refund_no_show_fee'), limitedEvidence, calculationProvider);
    expect(error).toBeUndefined();
    expect(action.amountCents).toBe(100); // capped at total paid
  });

  it('returns integer SGD cents', () => {
    const {action, error} = buildFinalAction(modelResponse('refund_route_excess'), routeEvidence, calculationProvider);
    expect(error).toBeUndefined();
    expect(Number.isInteger(action.amountCents)).toBe(true);
    expect(action.currency).toBe('SGD');
  });

  it('rejects a non-finite or non-integer provider amount before the paid-charge cap', () => {
    for (const amountCents of [NaN, Infinity, -Infinity, 12.5]) {
      const hostile: CalculationProvider = {
        calculateRouteExcess: () => ({amountCents, eligible: true}),
        getNoShowFee: () => ({amountCents, eligible: true}),
        getPaidChargeCap: () => 500,
      };
      const route = buildFinalAction(modelResponse('refund_route_excess'), routeEvidence, hostile, 'route_deviation');
      expect(route.error?.code).toBe('INVALID_CALCULATION');
      expect(route.action.amountCents).toBe(0);
      const noShow = buildFinalAction(modelResponse('refund_no_show_fee'), noShowEvidence, hostile, 'no_show');
      expect(noShow.error?.code).toBe('INVALID_CALCULATION');
      expect(noShow.action.amountCents).toBe(0);
    }
  });

  it('rejects a non-finite paid-charge cap instead of using it', () => {
    const hostileCap: CalculationProvider = {
      calculateRouteExcess: () => ({amountCents: 200, eligible: true}),
      getNoShowFee: () => ({amountCents: 200, eligible: true}),
      getPaidChargeCap: () => NaN,
    };
    const {action, error} = buildFinalAction(modelResponse('refund_route_excess'), routeEvidence, hostileCap, 'route_deviation');
    expect(error?.code).toBe('INVALID_CALCULATION');
    expect(action.amountCents).toBe(0);
  });
});
