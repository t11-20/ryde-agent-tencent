import { describe, expect, it } from "vitest";
import { checkFare } from "../src/calc/fare.js";
import { computeRemedyBasis } from "../src/calc/remedy.js";
import type { RouteMetrics } from "../src/calc/route.js";
import type { PaymentAvailable } from "../src/schemas/fixture.js";
import { noShowPayment, routePayment } from "./helpers.js";

const route = { excessMeters: 2642 } as RouteMetrics;
const mutate = (fn: (p: PaymentAvailable) => void, from = routePayment): PaymentAvailable => {
  const p = structuredClone(from());
  fn(p);
  return p;
};
const item = (p: PaymentAvailable, code: string) => p.lineItems.find((i) => i.code === code)!;
const fixTotals = (p: PaymentAvailable) => { p.totalCents = p.lineItems.reduce((s, i) => s + i.cents, 0); p.paidCents = p.totalCents; };

describe("fare validator", () => {
  it("accepts the valid R1S fare", () => {
    expect(checkFare(routePayment(), 10598)).toMatchObject({ arithmeticValid: true, arithmeticAnomalies: [] });
    expect(checkFare(noShowPayment(), null).arithmeticValid).toBe(true);
  });

  const cases: [string, PaymentAvailable, RegExp][] = [
    ["currency", mutate((p) => { p.currency = "USD"; }), /currency/],
    ["non-integer cents", mutate((p) => { item(p, "base").cents = 300.5; }), /not a safe integer/],
    ["non-integer totalCents", mutate((p) => { p.totalCents = 1910.2; }), /totalCents .* not a safe integer/],
    ["non-integer paidCents", mutate((p) => { p.paidCents = 1910.2; }), /paidCents .* not a safe integer/],
    ["base mismatch", mutate((p) => { item(p, "base").cents = 301; fixTotals(p); }), /base 301/],
    ["distance mismatch", mutate((p) => { item(p, "distance").cents = 796; fixTotals(p); }), /distance 796/],
    ["time mismatch", mutate((p) => { item(p, "time").cents = 379; fixTotals(p); }), /time 379/],
    ["surge missing", mutate((p) => { p.lineItems = p.lineItems.filter((i) => i.code !== "surge"); fixTotals(p); }), /no surge line item/],
    ["surge mismatch", mutate((p) => { item(p, "surge").cents = 736; fixTotals(p); }), /surge 736/],
    ["surge item without surge", mutate((p) => { p.surgeMultiplierX100 = 100; }), /non-zero surge/],
    ["positive promo", mutate((p) => { item(p, "promo").cents = 300; fixTotals(p); }), /promo 300 must be <= 0/],
    ["negative item", mutate((p) => { p.lineItems.push({ code: "time", label: "x", cents: -5, quantity: 0, unit: "s" }); fixTotals(p); }), /time -5 must be >= 0/],
    ["no-show fee mismatch", mutate((p) => { p.lineItems[0]!.cents = 400; fixTotals(p); }, noShowPayment), /no_show_fee 400/],
    ["sum mismatch", mutate((p) => { p.totalCents = 1900; p.paidCents = 1900; }), /sum 1910 != totalCents 1900/],
    ["paid mismatch", mutate((p) => { p.paidCents = 1000; }), /paidCents 1000 != totalCents 1910/],
  ];
  it.each(cases)("detects %s", (_name, payment, re) => {
    const r = checkFare(payment, 10598);
    expect(r.arithmeticValid).toBe(false);
    expect(r.arithmeticAnomalies.some((a) => re.test(a))).toBe(true);
  });

  it("does not throw on garbage numbers", () => {
    expect(() => checkFare(mutate((p) => { item(p, "distance").quantity = -3.3; p.surgeMultiplierX100 = 1.5; }), 1)).not.toThrow();
  });

  it("reports billed-vs-GPS observations", () => {
    const o = checkFare(routePayment(), 10000).observations;
    expect(o).toMatchObject({ billedDistanceMeters: 10598, gpsDistanceMeters: 10000, billedVsGpsDeltaPct: 6 });
    expect(o.notes).toHaveLength(1);
    expect(checkFare(routePayment(), 10598).observations.notes).toEqual([]);
  });
});

describe("remedy basis", () => {
  it("computes the surged, capped route refund in integer cents", () => {
    const p = routePayment();
    const b = computeRemedyBasis("route_deviation", p, checkFare(p, 10598), route);
    expect(b.map((x) => [x.remedyId, x.eligibleCents])).toEqual([["keep_charge", 0], ["refund_route_excess", 297], ["refund_no_show_fee", null]]);
    expect(b[2]?.unavailableReason).toBe("not applicable to category");
  });
  it("caps at the surged distance charge and at the amount paid", () => {
    const p = routePayment();
    const huge = { excessMeters: 100000 } as RouteMetrics;
    expect(computeRemedyBasis("route_deviation", p, checkFare(p, 10598), huge)[1]?.eligibleCents).toBe(1193);
    const cheap = mutate((x) => { item(x, "promo").cents = -2000; fixTotals(x); });
    expect(computeRemedyBasis("route_deviation", cheap, checkFare(cheap, 10598), huge)[1]?.eligibleCents).toBe(210);
  });
  it("a broken fare makes both refunds null", () => {
    const badRoute = mutate((p) => { p.paidCents = 1; });
    expect(computeRemedyBasis("route_deviation", badRoute, checkFare(badRoute, 10598), route)[1]).toMatchObject({ eligibleCents: null, unavailableReason: "fare arithmetic invalid" });
    const badNs = mutate((p) => { p.lineItems[0]!.cents = 400; fixTotals(p); }, noShowPayment);
    expect(computeRemedyBasis("no_show", badNs, checkFare(badNs, null), null)[2]).toMatchObject({ eligibleCents: null, unavailableReason: "fare arithmetic invalid" });
  });
  it("null with a reason when inputs are missing", () => {
    const p = routePayment();
    expect(computeRemedyBasis("route_deviation", p, checkFare(p, null), null)[1]?.unavailableReason).toBe("GPS route metrics unavailable");
    expect(computeRemedyBasis("no_show", { status: "unavailable", reason: "x" }, null, null)[2]?.unavailableReason).toBe("payment record unavailable");
    const noDist = mutate((x) => { x.lineItems = x.lineItems.filter((i) => i.code !== "distance" && i.code !== "surge"); x.surgeMultiplierX100 = 100; fixTotals(x); });
    expect(computeRemedyBasis("route_deviation", noDist, checkFare(noDist, null), route)[1]?.unavailableReason).toBe("no distance line item");
  });
  it("refunds the paid no-show fee", () => {
    const p = noShowPayment();
    expect(computeRemedyBasis("no_show", p, checkFare(p, null), null)[2]?.eligibleCents).toBe(500);
  });
});
