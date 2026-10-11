import type { Fixture } from './schemas.js';
import type { RouteMetrics } from './route.js';
import type { FareCheck } from './fare.js';
import { divHalfUp } from './money.js';

export interface RemedyBasisEntry {
  remedyId: 'keep_charge' | 'refund_route_excess' | 'refund_no_show_fee';
  eligibleCents: number | null;
  formula: string;
  unavailableReason: string | null;
}

const fareInvalid = (fare: FareCheck | null): boolean => fare === null || !fare.arithmeticValid;

/**
 * SPEC §5.9. Returns null when the payment is unavailable; otherwise exactly three
 * entries (keep_charge, refund_route_excess, refund_no_show_fee) in that order.
 */
export function remedyBasis(
  fixture: Fixture,
  route: RouteMetrics | null,
  fare: FareCheck | null
): RemedyBasisEntry[] | null {
  const payment = fixture.payment;
  if (payment.status !== 'available') return null;

  return [keepChargeEntry(), routeExcessEntry(fixture, route, fare), noShowFeeEntry(fixture, fare)];
}

function keepChargeEntry(): RemedyBasisEntry {
  return { remedyId: 'keep_charge', eligibleCents: 0, formula: '0 (charge unchanged)', unavailableReason: null };
}

function routeExcessEntry(fixture: Fixture, route: RouteMetrics | null, fare: FareCheck | null): RemedyBasisEntry {
  const id = 'refund_route_excess' as const;
  const payment = fixture.payment;
  if (payment.status !== 'available') return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'payment unavailable' };

  if (fixture.dispute.category !== 'route_deviation') {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'not applicable to category' };
  }
  if (route === null) {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'GPS route metrics unavailable' };
  }
  if (fareInvalid(fare)) {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'fare arithmetic invalid' };
  }
  if (!route.exceedsThreshold) {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'detour not material under RD-1' };
  }

  const distanceCents = payment.lineItems.reduce((sum, li) => (li.code === 'distance' ? sum + li.cents : sum), 0);
  if (!payment.lineItems.some(li => li.code === 'distance')) {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'no distance line item' };
  }

  const x = payment.surgeMultiplierX100;
  const per = payment.rateCard.perKmCents;
  const byDistance = divHalfUp(route.excessMeters * per * x, 100000);
  const byCharged = divHalfUp(distanceCents * x, 100);
  const eligibleCents = Math.min(byDistance, byCharged, payment.paidCents);
  const formula =
    `min(divHalfUp(${route.excessMeters} x ${per} x ${x}, 100000) = ${byDistance}, ` +
    `divHalfUp(${distanceCents} x ${x}, 100) = ${byCharged}, paid ${payment.paidCents}) = ${eligibleCents}`;
  return { remedyId: id, eligibleCents, formula, unavailableReason: null };
}

function noShowFeeEntry(fixture: Fixture, fare: FareCheck | null): RemedyBasisEntry {
  const id = 'refund_no_show_fee' as const;
  const payment = fixture.payment;
  if (payment.status !== 'available') return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'payment unavailable' };

  if (fixture.dispute.category !== 'no_show') {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'not applicable to category' };
  }
  if (fareInvalid(fare)) {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'fare arithmetic invalid' };
  }

  const feeSum = payment.lineItems.reduce((sum, li) => (li.code === 'no_show_fee' ? sum + li.cents : sum), 0);
  if (feeSum === 0) {
    return { remedyId: id, eligibleCents: null, formula: 'n/a', unavailableReason: 'no no-show fee charged' };
  }

  const eligibleCents = Math.min(feeSum, payment.paidCents);
  const formula = `min(no_show_fee ${feeSum}, paid ${payment.paidCents}) = ${eligibleCents}`;
  return { remedyId: id, eligibleCents, formula, unavailableReason: null };
}
