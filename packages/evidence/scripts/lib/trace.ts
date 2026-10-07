import { haversineRaw } from "../../src/calc/geo.js";
import { toEpochSec, toIsoUtc } from "../../src/calc/time.js";
import type { IsoUtc, LatLng, Ping } from "../../src/schemas/dispute.js";

export type Leg = { to: LatLng; kmh: number } | { dwellSec: number };

const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;

/** Exact trace builder from handoff section 6.1. */
export function trace(start: LatLng, startIso: IsoUtc, legs: readonly Leg[], everySec = 15): Ping[] {
  const out: Ping[] = [];
  const emit = (p: LatLng, t: number): void => { out.push({ ts: toIsoUtc(t), lat: r6(p[0]), lng: r6(p[1]) }); };
  let t = toEpochSec(startIso);
  let pos: LatLng = start;
  emit(pos, t);
  for (const leg of legs) {
    if ("dwellSec" in leg) {
      const end = t + leg.dwellSec;
      for (let s = t + everySec; s < end; s += everySec) emit(pos, s);
      emit(pos, end);
      t = end;
    } else {
      const d = haversineRaw(pos, leg.to);
      const dur = Math.round(d / (leg.kmh / 3.6));
      if (dur === 0) continue;
      const steps = Math.ceil(dur / everySec);
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        emit([pos[0] + (leg.to[0] - pos[0]) * f, pos[1] + (leg.to[1] - pos[1]) * f], t + Math.round(dur * f));
      }
      t += dur;
      pos = leg.to;
    }
  }
  return out;
}
