import { describe, expect, it } from 'vitest';
import { checkFare, findFixture, loadDataset, type AvailablePayment } from '../src/index.js';

const ds = loadDataset();

/** A mutable deep copy of a fixture's available payment. */
function paymentOf(fixtureId: string): AvailablePayment {
  const f = findFixture(ds, fixtureId);
  if (f === undefined) throw new Error(`${fixtureId} not found`);
  if (f.payment.status !== 'available') throw new Error(`${fixtureId} payment unavailable`);
  return structuredClone(f.payment);
}

function item(p: AvailablePayment, code: string): AvailablePayment['lineItems'][number] {
  const li = p.lineItems.find(l => l.code === code);
  if (li === undefined) throw new Error(`no ${code} item`);
  return li;
}

describe('checkFare — valid fixtures (SPEC §5.8, §7)', () => {
  it('every available payment is arithmetically valid with no anomalies', () => {
    for (const f of ds.fixtures) {
      if (f.payment.status !== 'available') continue;
      const result = checkFare(f.payment);
      expect(result.anomalies, `${f.fixtureId} anomalies`).toEqual([]);
      expect(result.arithmeticValid, `${f.fixtureId} valid`).toBe(true);
    }
  });

  it('R1 line items and total match SPEC §7', () => {
    const p = paymentOf('R1');
    expect(item(p, 'base').cents).toBe(300);
    expect(item(p, 'distance').cents).toBe(795);
    expect(item(p, 'time').cents).toBe(378);
    expect(p.totalCents).toBe(1473);
    expect(checkFare(p)).toEqual({ arithmeticValid: true, anomalies: [] });
  });

  it('R1S surge and promo match SPEC §7', () => {
    const p = paymentOf('R1S');
    expect(item(p, 'surge').cents).toBe(737);
    expect(item(p, 'promo').cents).toBe(-300);
    expect(p.totalCents).toBe(1910);
    expect(checkFare(p)).toEqual({ arithmeticValid: true, anomalies: [] });
  });
});

describe('checkFare — anomaly codes (SPEC §5.8)', () => {
  it("currency 'USD' → currency_not_sgd", () => {
    const p = paymentOf('R1');
    p.currency = 'USD';
    expect(checkFare(p).anomalies).toContain('currency_not_sgd');
  });

  it('base cents 301 → base_mismatch', () => {
    const p = paymentOf('R1');
    item(p, 'base').cents = 301;
    expect(checkFare(p).anomalies).toContain('base_mismatch');
  });

  it('distance cents +1 → distance_mismatch', () => {
    const p = paymentOf('R1');
    const d = item(p, 'distance');
    d.cents = d.cents + 1;
    expect(checkFare(p).anomalies).toContain('distance_mismatch');
  });

  it('time cents +1 → time_mismatch', () => {
    const p = paymentOf('R1');
    const t = item(p, 'time');
    t.cents = t.cents + 1;
    expect(checkFare(p).anomalies).toContain('time_mismatch');
  });

  it('R1S surge cents +1 → surge_mismatch', () => {
    const p = paymentOf('R1S');
    const s = item(p, 'surge');
    s.cents = s.cents + 1;
    expect(checkFare(p).anomalies).toContain('surge_mismatch');
  });

  it('R1S promo cents +300 → promo_positive', () => {
    const p = paymentOf('R1S');
    item(p, 'promo').cents = 300;
    expect(checkFare(p).anomalies).toContain('promo_positive');
  });

  it('R1 time cents -378 → negative_item', () => {
    const p = paymentOf('R1');
    item(p, 'time').cents = -378;
    expect(checkFare(p).anomalies).toContain('negative_item');
  });

  it('N1 fee cents 400 → no_show_fee_mismatch', () => {
    const p = paymentOf('N1');
    item(p, 'no_show_fee').cents = 400;
    expect(checkFare(p).anomalies).toContain('no_show_fee_mismatch');
  });

  it('totalCents + 1 → total_mismatch', () => {
    const p = paymentOf('R1');
    p.totalCents = p.totalCents + 1;
    expect(checkFare(p).anomalies).toContain('total_mismatch');
  });

  it('paidCents - 1 → paid_mismatch', () => {
    const p = paymentOf('R1');
    p.paidCents = p.paidCents - 1;
    expect(checkFare(p).anomalies).toContain('paid_mismatch');
  });

  it('distance cents 795.5 → non_integer_amount', () => {
    const p = paymentOf('R1');
    item(p, 'distance').cents = 795.5;
    expect(checkFare(p).anomalies).toContain('non_integer_amount');
  });
});
