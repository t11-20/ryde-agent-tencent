import type { EvidenceRecord, UnavailableFamily } from "../schemas/evidence.js";
import { formatDuration, formatKm, seqId } from "../format.js";
import { toEpochSec } from "../calc/time.js";
import { provenance, type EvidenceContext } from "./context.js";

export function gpsEvidence(ctx: EvidenceContext): { records: EvidenceRecord[]; unavailable: UnavailableFamily[] } {
  const { fixture } = ctx;
  if (fixture.gps.status !== "available") {
    return { records: [], unavailable: [{ family: "gps", reason: fixture.gps.reason }] };
  }
  const gps = fixture.gps;
  const records: EvidenceRecord[] = [];

  if (fixture.dispute.category === "route_deviation") {
    const r = ctx.route;
    if (!r) return { records: [], unavailable: [{ family: "gps", reason: "GPS present but no reference route or driver trace for route metrics." }] };
    const stops = r.unexpectedStops;
    records.push({
      id: "GPS-ROUTE",
      family: "gps",
      kind: "route_metrics",
      timestamp: r.tripStartTs,
      summary:
        `Actual ${formatKm(r.actualMeters)} vs reference ${formatKm(r.referenceMeters)}: +${formatKm(r.excessMeters)} (+${r.excessPct.toFixed(1)}%). ` +
        `RD-1 threshold ${formatKm(r.thresholdMeters)}: ${r.exceedsThreshold ? "exceeded" : "not exceeded"}. ` +
        `Duration ${formatDuration(r.actualDurationSec)} vs reference estimate ${formatDuration(r.referenceDurationSec)}; ` +
        `${stops.length} unexpected stop${stops.length === 1 ? "" : "s"}${stops.length ? ` (${stops.map((s) => `${s.durationSec} s`).join(", ")})` : ""}.`,
      facts: { ...r },
      provenance: provenance(ctx, ["gps.referenceRoute", "gps.driverTrace", "gps.events", "trip.pickup", "trip.dropoff"], "haversine path length (R=6371008.8 m, rounded to whole metres); RD-1 params from DEMONSTRATION POLICY; dwell detection 30 m / 120 s"),
    });
    const reroutes = gps.events.filter((e) => e.type === "reroute").sort((a, b) => toEpochSec(a.ts) - toEpochSec(b.ts));
    reroutes.forEach((e, i) => {
      records.push({
        id: seqId("GPS-NAV", i + 1),
        family: "gps",
        kind: "nav_event",
        timestamp: e.ts,
        summary: `Navigation reroute at ${e.ts}${e.reason ? ` (${e.reason})` : ""}${e.detail ? `: ${e.detail}` : ""}.`,
        facts: { type: e.type, reason: e.reason ?? null, detail: e.detail ?? null },
        provenance: provenance(ctx, [`gps.events[type=reroute][${i}]`], "event log passthrough"),
      });
    });
  }

  gps.trafficAdvisories
    .slice()
    .sort((a, b) => toEpochSec(a.ts) - toEpochSec(b.ts) || a.id.localeCompare(b.id))
    .forEach((adv, i) => {
      records.push({
        id: seqId("GPS-ADV", i + 1),
        family: "gps",
        kind: "traffic_advisory",
        timestamp: adv.ts,
        summary: `Traffic advisory ${adv.id} (${adv.type}) at ${adv.ts}: ${adv.description} Source: ${adv.source}.`,
        facts: { id: adv.id, type: adv.type, description: adv.description, source: adv.source },
        provenance: provenance(ctx, [`gps.trafficAdvisories[${i}]`], "advisory feed passthrough"),
      });
    });

  if (fixture.dispute.category === "no_show") {
    const p = ctx.pickup;
    if (!p) return { records, unavailable: [{ family: "gps", reason: "GPS present but no cancellation event or driver pings before cancellation." }] };
    const max = p.ns1Params.maxPickupDistanceMeters;
    records.push({
      id: "GPS-PICKUP",
      family: "gps",
      kind: "pickup_metrics",
      timestamp: p.cancelTs,
      summary:
        `Driver closest approach ${p.closestApproachMeters} m (NS-1 limit ${max} m): ${p.checks.withinDistance ? "within" : "never within"}. ` +
        (p.firstWithinThresholdTs
          ? `First within ${max} m at ${p.firstWithinThresholdTs}; waited ${p.waitSecondsWithinThreshold} s before cancelling (NS-1 minimum ${p.ns1Params.minWaitSeconds} s): ${p.checks.waitedMinimum ? "met" : "not met"}; ${p.remainedWithinThreshold ? "stayed within" : "left"} the limit. `
          : `Wait within ${max} m: not applicable. `) +
        `Distance at marked arrival: ${p.distanceAtMarkedArrivalMeters ?? "n/a"} m.`,
      facts: { ...p },
      provenance: provenance(ctx, ["gps.driverTrace", "gps.events", "trip.pickup"], "haversine distance to pickup pin (rounded metres); NS-1 params from DEMONSTRATION POLICY"),
    });
    const r = ctx.rider;
    records.push({
      id: "GPS-RIDER",
      family: "gps",
      kind: "rider_location",
      timestamp: p.cancelTs,
      summary:
        !r || !r.available
          ? "No rider location trace available for this trip."
          : `Rider closest approach before cancellation ${r.closestApproachMetersBeforeCancel ?? "n/a"} m; ${r.distanceAtCancelMeters} m from the pickup pin at cancellation; ` +
            (r.firstWithinThresholdTs ? `first within ${max} m at ${r.firstWithinThresholdTs}.` : `never within ${max} m.`),
      facts: r ? { ...r } : { available: false },
      provenance: provenance(ctx, ["gps.riderTrace", "gps.events", "trip.pickup"], "haversine distance to pickup pin (rounded metres)"),
    });
  }
  return { records, unavailable: [] };
}
