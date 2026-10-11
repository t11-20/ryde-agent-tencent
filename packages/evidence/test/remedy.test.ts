import { describe, expect, it } from 'vitest';
import {
  checkFare,
  findFixture,
  loadDataset,
  remedyBasis,
  routeMetrics,
  type Fixture,
  type PolicyParams,
  type RemedyBasisEntry,
} from '../src/index.js';

const ds = loadDataset();
const params: PolicyParams = ds.policy.params;

function fixtureOf(id: string): Fixture {
  const f = findFixture(ds, id);
  if (f === undefined) throw new Error(`${id} not found`);
  return f;
}

function basis(id: string): RemedyBasisEntry[] | null {
  const f = fixtureOf(id);
  const route = routeMetrics(f, params);
  const fare = f.payment.status === 'available' ? checkFare(f.payment) : null;
  return remedyBasis(f, route, fare);
}

function get(b: RemedyBasisEntry[] | null, remedyId: RemedyBasisEntry['remedyId']): RemedyBasisEntry {
  if (b === null) throw new Error('basis is null');
  const e = b.find(x => x.remedyId === remedyId);
  if (e === undefined) throw new Error(`missing ${remedyId}`);
  return e;
}

describe('remedyBasis — refund_route_excess golden values (SPEC §7)', () => {
  it.each([
    ['R1', 198],
    ['R1S', 297],
    ['R2', 116],
    ['R3', 129],
  ])('%s → %i', (id, expected) => {
    const e = get(basis(id), 'refund_route_excess');
    expect(e.eligibleCents).toBe(expected);
    expect(e.unavailableReason).toBeNull();
  });

  it.each(['R1', 'R1S', 'R2', 'R3'])('%s refund_no_show_fee not applicable to category', id => {
    const e = get(basis(id), 'refund_no_show_fee');
    expect(e.eligibleCents).toBeNull();
    expect(e.unavailableReason).toBe('not applicable to category');
  });
});

describe('remedyBasis — refund_no_show_fee golden values (SPEC §7)', () => {
  it.each(['N1', 'N2', 'N2H', 'N3', 'X2'])('%s → 500', id => {
    const e = get(basis(id), 'refund_no_show_fee');
    expect(e.eligibleCents).toBe(500);
    expect(e.unavailableReason).toBeNull();
  });
});

describe('remedyBasis — edge cases (SPEC §5.9)', () => {
  it('X1 refund_route_excess null with reason GPS route metrics unavailable', () => {
    const e = get(basis('X1'), 'refund_route_excess');
    expect(e.eligibleCents).toBeNull();
    expect(e.unavailableReason).toBe('GPS route metrics unavailable');
  });

  it('X3 returns null (payment unavailable)', () => {
    expect(basis('X3')).toBeNull();
  });

  it('keep_charge is always eligibleCents 0 with null reason', () => {
    for (const id of ['R1', 'R1S', 'R2', 'R3', 'X1', 'N1', 'N2', 'N2H', 'N3', 'X2']) {
      const e = get(basis(id), 'keep_charge');
      expect(e.eligibleCents, id).toBe(0);
      expect(e.unavailableReason, id).toBeNull();
    }
  });

  it('R1 with exceedsThreshold false → detour not material under RD-1', () => {
    const f = fixtureOf('R1');
    if (f.payment.status !== 'available') throw new Error('R1 payment unavailable');
    const route = routeMetrics(f, params);
    if (route === null) throw new Error('R1 route null');
    const fare = checkFare(f.payment);
    const b = remedyBasis(f, { ...route, exceedsThreshold: false }, fare);
    const e = get(b, 'refund_route_excess');
    expect(e.eligibleCents).toBeNull();
    expect(e.unavailableReason).toBe('detour not material under RD-1');
  });

  it('R1 with an invalid fare → both refunds null, route refund reason fare arithmetic invalid', () => {
    const f = fixtureOf('R1');
    const route = routeMetrics(f, params);
    const b = remedyBasis(f, route, { arithmeticValid: false, anomalies: ['total_mismatch'] });
    const routeRefund = get(b, 'refund_route_excess');
    expect(routeRefund.eligibleCents).toBeNull();
    expect(routeRefund.unavailableReason).toBe('fare arithmetic invalid');
    const noShow = get(b, 'refund_no_show_fee');
    expect(noShow.eligibleCents).toBeNull();
  });
});
