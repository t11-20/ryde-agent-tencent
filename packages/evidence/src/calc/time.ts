import type { IsoUtc } from "../schemas/dispute.js";

/** Epoch seconds for an IsoUtc string. */
export function toEpochSec(iso: IsoUtc): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`invalid timestamp: ${iso}`);
  return Math.round(ms / 1000);
}

/** IsoUtc ("YYYY-MM-DDTHH:mm:ssZ", no milliseconds) for whole epoch seconds. */
export function toIsoUtc(epochSec: number): IsoUtc {
  if (!Number.isSafeInteger(epochSec)) throw new Error(`epoch seconds must be an integer: ${epochSec}`);
  return new Date(epochSec * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Whole seconds from a to b. */
export function secondsBetween(a: IsoUtc, b: IsoUtc): number {
  return toEpochSec(b) - toEpochSec(a);
}
