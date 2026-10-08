import type { JudgeModelResponse, FinalAction, Evidence } from '@fairtrip/contracts';

export interface CalculationResult {
  amountCents: number;
  eligible: boolean;
}

export interface CalculationProvider {
  calculateRouteExcess(evidence: Evidence[]): CalculationResult | null;
  getNoShowFee(evidence: Evidence[]): CalculationResult | null;
  getPaidChargeCap(evidence: Evidence[]): number;
}

// Mock calculation provider for testing when partner adapters are unavailable.
// Returns fixed values that exercise all remedy types.
export function createMockCalculationProvider(): CalculationProvider {
  return {
    calculateRouteExcess(evidence: Evidence[]): CalculationResult | null {
      const payment = evidence.find(e => e.source === 'payment');
      if (!payment) return null;
      // Return a mock excess of 200 cents for route_deviation cases
      return {amountCents: 200, eligible: true};
    },
    getNoShowFee(evidence: Evidence[]): CalculationResult | null {
      const payment = evidence.find(e => e.source === 'payment');
      if (!payment) return null;
      // Return the cancellation fee as the no-show fee
      const facts = payment.facts as Record<string, unknown>;
      const fee = facts?.cancellationFeeCents;
      if (typeof fee === 'number' && fee > 0) {
        return {amountCents: fee, eligible: true};
      }
      return null;
    },
    getPaidChargeCap(evidence: Evidence[]): number {
      const payment = evidence.find(e => e.source === 'payment');
      if (!payment) return 0;
      const facts = payment.facts as Record<string, unknown>;
      const total = facts?.totalPaidCents;
      return typeof total === 'number' ? total : 0;
    }
  };
}

export interface RemedyValidationError {
  code: string;
  message: string;
}

export function buildFinalAction(
  modelResponse: JudgeModelResponse,
  evidence: Evidence[],
  calculationProvider: CalculationProvider
): {action: FinalAction; error?: RemedyValidationError} {
  const remedyId = modelResponse.remedyId;
  const category = evidence.some(e => e.id.startsWith('e-route')) ? 'route_deviation' :
                   evidence.some(e => e.id.startsWith('e-noshow')) ? 'no_show' :
                   'route_deviation'; // fallback

  // Validate remedy is appropriate for category
  if (category === 'route_deviation' && remedyId === 'refund_no_show_fee') {
    return {
      action: createNoAction(),
      error: {code: 'WRONG_CATEGORY_REMEDY', message: 'refund_no_show_fee is not applicable to route_deviation disputes'}
    };
  }
  if (category === 'no_show' && remedyId === 'refund_route_excess') {
    return {
      action: createNoAction(),
      error: {code: 'WRONG_CATEGORY_REMEDY', message: 'refund_route_excess is not applicable to no_show disputes'}
    };
  }

  let amountCents = 0;
  let recipient: 'rider' | 'driver' | 'none' = 'none';
  let recommendation = '';

  if (remedyId === 'keep_charge') {
    amountCents = 0;
    recipient = 'none';
    recommendation = 'No refund recommended. The charge is retained.';
  } else if (remedyId === 'refund_route_excess') {
    const calculation = calculationProvider.calculateRouteExcess(evidence);
    if (!calculation || !calculation.eligible) {
      return {
        action: createNoAction(),
        error: {code: 'INVALID_CALCULATION', message: 'Route excess calculation failed or returned ineligible'}
      };
    }
    const cap = calculationProvider.getPaidChargeCap(evidence);
    amountCents = Math.min(calculation.amountCents, cap);
    recipient = 'rider';
    recommendation = `Refund ${amountCents} SGD cents for route excess charge.`;
  } else if (remedyId === 'refund_no_show_fee') {
    const calculation = calculationProvider.getNoShowFee(evidence);
    if (!calculation || !calculation.eligible) {
      return {
        action: createNoAction(),
        error: {code: 'INVALID_CALCULATION', message: 'No-show fee calculation failed or returned ineligible'}
      };
    }
    const cap = calculationProvider.getPaidChargeCap(evidence);
    amountCents = Math.min(calculation.amountCents, cap);
    recipient = 'rider';
    recommendation = `Refund ${amountCents} SGD cents for no-show fee.`;
  }

  // Validate amount is integer, non-negative, finite
  if (!Number.isFinite(amountCents) || amountCents < 0 || !Number.isInteger(amountCents)) {
    return {
      action: createNoAction(),
      error: {code: 'INVALID_AMOUNT', message: `Amount ${amountCents} is not a valid integer SGD cents value`}
    };
  }

  // Validate refund does not exceed paid charge cap
  const cap = calculationProvider.getPaidChargeCap(evidence);
  if (amountCents > cap) {
    return {
      action: createNoAction(),
      error: {code: 'EXCESSIVE_REFUND', message: `Refund ${amountCents} exceeds paid charge cap ${cap}`}
    };
  }

  const action: FinalAction = {
    remedyId,
    recipient,
    currency: 'SGD',
    amountCents,
    recommendation
  };

  return {action};
}

function createNoAction(): FinalAction {
  return {
    remedyId: 'keep_charge',
    recipient: 'none',
    currency: 'SGD',
    amountCents: 0,
    recommendation: 'No action due to validation failure.'
  };
}
