import type { Fixture } from './schemas.js';
import { divHalfUp } from './money.js';

export type AvailablePayment = Extract<Fixture['payment'], { status: 'available' }>;

export interface FareCheck {
  arithmeticValid: boolean;
  anomalies: string[];
}

const isSafeNonNegInt = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;

/** Guarded divHalfUp: returns null instead of throwing when inputs are not non-negative safe integers. */
function safeDiv(n: number, d: number): number | null {
  if (!isSafeNonNegInt(n) || !Number.isSafeInteger(d) || d <= 0) return null;
  return divHalfUp(n, d);
}

/**
 * SPEC §5.8. Validates fare arithmetic in integer cents. Codes are pushed in the
 * table's order. Every divHalfUp call is guarded: a missing quantity or a
 * non-integer input records the matching anomaly instead of throwing.
 */
export function checkFare(payment: AvailablePayment): FareCheck {
  const anomalies: string[] = [];
  const { rateCard, lineItems, totalCents, paidCents } = payment;

  const sumByCode = (code: string): number =>
    lineItems.reduce((sum, li) => (li.code === code ? sum + li.cents : sum), 0);

  // 1. currency_not_sgd
  if (payment.currency !== 'SGD') anomalies.push('currency_not_sgd');

  // 2. non_integer_amount: every line-item cents, totalCents and paidCents is a safe integer
  const allIntegers =
    lineItems.every(li => Number.isSafeInteger(li.cents)) &&
    Number.isSafeInteger(totalCents) &&
    Number.isSafeInteger(paidCents);
  if (!allIntegers) anomalies.push('non_integer_amount');

  // 3. base_mismatch: if a base item exists, its cents sum to rateCard.baseCents
  if (lineItems.some(li => li.code === 'base') && sumByCode('base') !== rateCard.baseCents) {
    anomalies.push('base_mismatch');
  }

  // 4. distance_mismatch: cents = divHalfUp(quantity * perKmCents, 1000)
  const distanceItem = lineItems.find(li => li.code === 'distance');
  if (distanceItem !== undefined) {
    const q = distanceItem.quantity;
    const expected = q === undefined ? null : safeDiv(q * rateCard.perKmCents, 1000);
    if (expected === null || distanceItem.cents !== expected) anomalies.push('distance_mismatch');
  }

  // 5. time_mismatch: cents = divHalfUp(quantity * perMinCents, 60)
  const timeItem = lineItems.find(li => li.code === 'time');
  if (timeItem !== undefined) {
    const q = timeItem.quantity;
    const expected = q === undefined ? null : safeDiv(q * rateCard.perMinCents, 60);
    if (expected === null || timeItem.cents !== expected) anomalies.push('time_mismatch');
  }

  // 6. surge_mismatch
  const x = payment.surgeMultiplierX100;
  if (x > 100) {
    const surgeItem = lineItems.find(li => li.code === 'surge');
    const bdt = sumByCode('base') + sumByCode('distance') + sumByCode('time');
    const expected = safeDiv(bdt * (x - 100), 100);
    if (surgeItem === undefined || expected === null || surgeItem.cents !== expected) {
      anomalies.push('surge_mismatch');
    }
  } else if (x === 100 && sumByCode('surge') !== 0) {
    anomalies.push('surge_mismatch');
  }

  // 7. promo_positive: every promo item has cents <= 0
  if (lineItems.some(li => li.code === 'promo' && li.cents > 0)) anomalies.push('promo_positive');

  // 8. negative_item: every non-promo item has cents >= 0
  if (lineItems.some(li => li.code !== 'promo' && li.cents < 0)) anomalies.push('negative_item');

  // 9. no_show_fee_mismatch: if a no_show_fee item exists, its sum = rateCard.noShowFeeCents
  if (lineItems.some(li => li.code === 'no_show_fee') && sumByCode('no_show_fee') !== rateCard.noShowFeeCents) {
    anomalies.push('no_show_fee_mismatch');
  }

  // 10. total_mismatch: sum of all line items = totalCents
  const lineSum = lineItems.reduce((sum, li) => sum + li.cents, 0);
  if (lineSum !== totalCents) anomalies.push('total_mismatch');

  // 11. paid_mismatch: paidCents === totalCents
  if (paidCents !== totalCents) anomalies.push('paid_mismatch');

  return { arithmeticValid: anomalies.length === 0, anomalies };
}
