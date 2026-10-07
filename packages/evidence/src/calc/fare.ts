import type { LineItem, PaymentAvailable } from "../schemas/fixture.js";
import { round1 } from "./geo.js";
import { divHalfUp, isNonNegInt, isSafeInt } from "./money.js";

export const GPS_BILLING_DELTA_NOTE_PCT = 5;

export interface FareObservations {
  billedDistanceMeters: number | null;
  gpsDistanceMeters: number | null;
  billedVsGpsDeltaPct: number | null;
  notes: string[];
}

export interface FareCheck {
  arithmeticValid: boolean;
  arithmeticAnomalies: string[];
  observations: FareObservations;
}

const sumCents = (items: readonly LineItem[], code: LineItem["code"]): number =>
  items.filter((i) => i.code === code).reduce((s, i) => s + i.cents, 0);

/** Validates the fare arithmetic against the rate card. Never throws on bad data; reports anomalies instead. */
export function checkFare(payment: PaymentAvailable, gpsDistanceMeters: number | null): FareCheck {
  const a: string[] = [];
  const { rateCard, lineItems } = payment;

  if (payment.currency !== "SGD") a.push(`currency is ${JSON.stringify(payment.currency)}, expected "SGD"`);

  let allInts = true;
  lineItems.forEach((li, idx) => {
    if (!isSafeInt(li.cents)) { a.push(`line item ${idx} (${li.code}) cents ${li.cents} is not a safe integer`); allInts = false; }
  });
  if (!isSafeInt(payment.totalCents)) { a.push(`totalCents ${payment.totalCents} is not a safe integer`); allInts = false; }
  if (!isSafeInt(payment.paidCents)) { a.push(`paidCents ${payment.paidCents} is not a safe integer`); allInts = false; }
  for (const [k, v] of Object.entries(rateCard)) {
    if (!isNonNegInt(v)) a.push(`rateCard.${k} ${v} is not a non-negative safe integer`);
  }
  if (!isNonNegInt(payment.surgeMultiplierX100)) a.push(`surgeMultiplierX100 ${payment.surgeMultiplierX100} is not a non-negative safe integer`);

  for (const li of lineItems) {
    if (li.code === "base" && li.cents !== rateCard.baseCents) a.push(`base ${li.cents} != rateCard.baseCents ${rateCard.baseCents}`);
    if (li.code === "distance") {
      if (!isNonNegInt(li.quantity) || !isNonNegInt(rateCard.perKmCents)) a.push(`distance quantity ${li.quantity} is not a non-negative integer number of metres`);
      else {
        const exp = divHalfUp(li.quantity * rateCard.perKmCents, 1000);
        if (li.cents !== exp) a.push(`distance ${li.cents} != divHalfUp(${li.quantity} x ${rateCard.perKmCents}, 1000) = ${exp}`);
      }
    }
    if (li.code === "time") {
      if (!isNonNegInt(li.quantity) || !isNonNegInt(rateCard.perMinCents)) a.push(`time quantity ${li.quantity} is not a non-negative integer number of seconds`);
      else {
        const exp = divHalfUp(li.quantity * rateCard.perMinCents, 60);
        if (li.cents !== exp) a.push(`time ${li.cents} != divHalfUp(${li.quantity} x ${rateCard.perMinCents}, 60) = ${exp}`);
      }
    }
    if (li.code === "no_show_fee" && li.cents !== rateCard.noShowFeeCents) a.push(`no_show_fee ${li.cents} != rateCard.noShowFeeCents ${rateCard.noShowFeeCents}`);
    if (li.code === "promo" && !(li.cents <= 0)) a.push(`promo ${li.cents} must be <= 0`);
    if (li.code !== "promo" && !(li.cents >= 0)) a.push(`${li.code} ${li.cents} must be >= 0`);
  }

  const x = payment.surgeMultiplierX100;
  const surgeItems = lineItems.filter((i) => i.code === "surge");
  if (isNonNegInt(x) && x > 100) {
    if (surgeItems.length === 0) a.push(`surgeMultiplierX100 ${x} but no surge line item`);
    else {
      const pre = sumCents(lineItems, "base") + sumCents(lineItems, "distance") + sumCents(lineItems, "time");
      const surge = sumCents(lineItems, "surge");
      if (isNonNegInt(pre)) {
        const exp = divHalfUp(pre * (x - 100), 100);
        if (surge !== exp) a.push(`surge ${surge} != divHalfUp(${pre} x ${x - 100}, 100) = ${exp}`);
      }
    }
  } else if (x === 100) {
    if (surgeItems.some((i) => i.cents !== 0)) a.push(`surgeMultiplierX100 is 100 but a non-zero surge item exists`);
  } else if (isNonNegInt(x) && x < 100) {
    a.push(`surgeMultiplierX100 ${x} is below 100`);
  }

  if (allInts) {
    const sum = lineItems.reduce((s, i) => s + i.cents, 0);
    if (sum !== payment.totalCents) a.push(`line items sum ${sum} != totalCents ${payment.totalCents}`);
  }
  if (payment.paidCents !== payment.totalCents) a.push(`paidCents ${payment.paidCents} != totalCents ${payment.totalCents}`);

  const billed = lineItems.find((i) => i.code === "distance")?.quantity ?? null;
  const notes: string[] = [];
  let delta: number | null = null;
  if (billed !== null && gpsDistanceMeters !== null && gpsDistanceMeters > 0) {
    delta = round1(((billed - gpsDistanceMeters) / gpsDistanceMeters) * 100);
    if (Math.abs(delta) > GPS_BILLING_DELTA_NOTE_PCT) notes.push(`Billed distance differs from GPS distance by ${delta}% (more than ${GPS_BILLING_DELTA_NOTE_PCT}%).`);
  }

  return {
    arithmeticValid: a.length === 0,
    arithmeticAnomalies: a,
    observations: { billedDistanceMeters: billed, gpsDistanceMeters, billedVsGpsDeltaPct: delta, notes },
  };
}
