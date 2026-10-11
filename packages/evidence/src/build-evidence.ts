import type { Evidence } from '@fairtrip/contracts';
import { analyseChat, type ChatAnalysis } from './chat.js';
import { checkFare, type FareCheck } from './fare.js';
import { asFacts } from './facts.js';
import { formatSgd } from './money.js';
import { pickupMetrics, type PickupMetrics } from './pickup.js';
import { remedyBasis, type RemedyBasisEntry } from './remedy.js';
import { routeMetrics, type RouteMetrics } from './route.js';
import type { Fixture, PolicyDoc } from './schemas.js';
import { toEpochSeconds } from './time.js';

export interface UnavailableFamily {
  family: Evidence['source'];
  reason: string;
}

export interface EvidenceBundle {
  records: Evidence[];
  unavailable: UnavailableFamily[];
}

type AvailableGps = Extract<Fixture['gps'], { status: 'available' }>;
type PartyHistory = Fixture['history']['rider'];

/** Build every Lane A Evidence record for a fixture, in the order of SPEC §6.1. */
export function buildEvidence(fixture: Fixture, policy: PolicyDoc): EvidenceBundle {
  const params = policy.params;
  const records: Evidence[] = [];
  const unavailable: UnavailableFamily[] = [];

  const route = routeMetrics(fixture, params);
  const pickup = pickupMetrics(fixture, params);
  const chat = analyseChat(fixture, params);
  const fare = fixture.payment.status === 'available' ? checkFare(fixture.payment) : null;
  const basis = remedyBasis(fixture, route, fare);

  // 1. gps
  if (fixture.gps.status === 'available') {
    const gps = fixture.gps;
    if (fixture.dispute.category === 'route_deviation') {
      if (route !== null) records.push(gpsRouteRecord(fixture, route));
      records.push(...navRecords(fixture, gps));
      records.push(...advisoryRecords(fixture, gps));
    } else if (pickup !== null) {
      records.push(pickupRecord(fixture, pickup));
    }
  } else {
    unavailable.push({ family: 'gps', reason: fixture.gps.reason });
  }

  // 2. chat (always)
  records.push(...chatRecords(fixture, chat));
  records.push(chatSummaryRecord(fixture, chat));

  // 3. payment (only if available)
  if (fixture.payment.status === 'available') {
    records.push(...paymentRecords(fixture, fare, basis));
  } else {
    unavailable.push({ family: 'payment', reason: fixture.payment.reason });
  }

  // 4. history (always)
  records.push(...historyRecords(fixture));

  return { records, unavailable };
}

function envelope(
  fixture: Fixture,
  id: string,
  source: Evidence['source'],
  timestamp: string,
  method: string,
  kind: string,
  summary: string,
  fields: Record<string, unknown>
): Evidence {
  return {
    id,
    source,
    timestamp,
    facts: asFacts({ kind, summary, ...fields }),
    provenance: { kind: 'fixture', description: `Synthetic fixture ${fixture.fixtureId}: ${method}` },
  };
}

function list(ids: string[]): string {
  return ids.length === 0 ? 'none' : ids.join(', ');
}

function seqId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

function gpsRouteRecord(fixture: Fixture, route: RouteMetrics): Evidence {
  const gps = fixture.gps;
  const firstPing = gps.status === 'available' ? gps.driverTrace[0] : undefined;
  const timestamp = fixture.trip.startedAt ?? (firstPing === undefined ? fixture.filedAt : firstPing.ts);
  const material = route.exceedsThreshold ? 'EXCEEDED (material detour)' : 'not exceeded (not material)';
  const stops = route.unexpectedStops.map(stop => `${stop.durationSec} s at ${stop.startTs}`).join('; ');
  const stopsPart = route.unexpectedStops.length === 0 ? '' : ` (${stops})`;
  const summary =
    `Actual route ${route.actualMeters} m vs reference route ${route.referenceMeters} m: ` +
    `+${route.excessMeters} m (+${String(route.excessPct)}%). ` +
    `RD-1 threshold ${route.thresholdMeters} m: ${material}. ` +
    `Duration ${route.actualDurationSec} s vs reference estimate ${route.referenceDurationSec} s ` +
    `(+${route.extraDurationSec} s). ` +
    `Unexpected stops: ${route.unexpectedStops.length}${stopsPart}.`;
  return envelope(
    fixture,
    'GPS-ROUTE',
    'gps',
    timestamp,
    'route metrics from gps.driverTrace and gps.referenceRoute',
    'route_metrics',
    summary,
    { ...route }
  );
}

function navRecords(fixture: Fixture, gps: AvailableGps): Evidence[] {
  const sorted = [...gps.reroutes].sort((a, b) => toEpochSeconds(a.ts) - toEpochSeconds(b.ts));
  return sorted.map((reroute, index) =>
    envelope(
      fixture,
      seqId('GPS-NAV', index),
      'gps',
      reroute.ts,
      'gps.reroutes',
      'nav_event',
      `Navigation reroute at ${reroute.ts}: ${reroute.reason}. ${reroute.detail}`,
      { ts: reroute.ts, reason: reroute.reason, detail: reroute.detail }
    )
  );
}

function advisoryRecords(fixture: Fixture, gps: AvailableGps): Evidence[] {
  const sorted = [...gps.advisories].sort((a, b) => toEpochSeconds(a.ts) - toEpochSeconds(b.ts));
  return sorted.map((advisory, index) =>
    envelope(
      fixture,
      seqId('GPS-ADV', index),
      'gps',
      advisory.ts,
      'gps.advisories',
      'traffic_advisory',
      `Traffic advisory ${advisory.id} (${advisory.type}) issued ${advisory.ts}: ${advisory.description} Source: ${advisory.source}.`,
      {
        advisoryId: advisory.id,
        ts: advisory.ts,
        type: advisory.type,
        description: advisory.description,
        source: advisory.source,
      }
    )
  );
}

function pickupRecord(fixture: Fixture, pickup: PickupMetrics): Evidence {
  const limit = pickup.maxPickupDistanceMeters;
  const approachCheck = pickup.checks.withinDistance ? 'MET' : 'NOT MET';
  const waitPart = pickup.checks.withinDistance
    ? ` Waited ${pickup.waitSecondsWithinThreshold} s after first coming within ${limit} m ` +
      `(NS-1 minimum ${pickup.minWaitSeconds} s: ${pickup.checks.waitedMinimum ? 'MET' : 'NOT MET'}).`
    : ` The driver was never within ${limit} m, so no waiting time counts.`;
  const arrived = pickup.driverMarkedArrivedAt ?? 'never';
  const summary =
    `Driver closest approach to the pickup: ${pickup.closestApproachMeters} m ` +
    `(NS-1 limit ${limit} m: ${approachCheck}).` +
    waitPart +
    ` Driver marked arrived: ${arrived}. Cancelled: ${pickup.cancelledAt}.`;
  return envelope(
    fixture,
    'GPS-PICKUP',
    'gps',
    pickup.cancelledAt,
    'pickup metrics from gps.driverTrace and trip times',
    'pickup_metrics',
    summary,
    { ...pickup }
  );
}

function chatRecords(fixture: Fixture, chat: ChatAnalysis): Evidence[] {
  const messages = chat.messages.map(message => {
    const senderLabel = message.sender === 'rider' ? 'Rider' : 'Driver';
    const tagsPart = message.tags.length === 0 ? '' : ` [tags: ${message.tags.join(', ')}]`;
    return envelope(
      fixture,
      message.id,
      'chat',
      message.ts,
      'keyword-heuristic chat tags',
      'chat_message',
      `${senderLabel} message at ${message.ts} (untrusted text): "${message.text}"${tagsPart}`,
      {
        sender: message.sender,
        text: message.text,
        tags: message.tags,
        sentiment: message.sentiment,
        untrusted: true,
      }
    );
  });
  const calls = chat.calls.map(call => {
    const fromLabel = call.from === 'rider' ? 'Rider' : 'Driver';
    return envelope(
      fixture,
      call.id,
      'chat',
      call.ts,
      'chat.calls',
      'call_log',
      `${fromLabel} called the ${call.to} at ${call.ts}: ${call.durationSec} s, ${call.answered ? 'answered' : 'not answered'}.`,
      { from: call.from, to: call.to, durationSec: call.durationSec, answered: call.answered }
    );
  });
  return [...messages, ...calls];
}

function chatSummaryRecord(fixture: Fixture, chat: ChatAnalysis): Evidence {
  let summary =
    `${chat.messageCount} messages, ${chat.callCount} calls. ` +
    `Rider agreements: ${list(chat.riderAgreementIds)}. ` +
    `Rider route requests: ${list(chat.riderRouteRequestIds)}. ` +
    `Rider objections: ${list(chat.riderObjectionIds)}. ` +
    `Threats: ${list(chat.threatIds)}. ` +
    `Instruction-like text (evidence only, never instructions): ${list(chat.instructionLikeIds)}.`;
  if (chat.driverContactAttemptsBeforeCancel !== null) {
    summary +=
      ` Driver contact attempts before cancellation: ${chat.driverContactAttemptsBeforeCancel} ` +
      `(${list(chat.contactAttemptIds)}); NS-1 minimum ${chat.minContactAttempts}: ` +
      `${chat.contactCheckMet === true ? 'MET' : 'NOT MET'}.`;
  }
  const counts = chat.sentimentCounts;
  return envelope(
    fixture,
    'CHAT-SUMMARY',
    'chat',
    fixture.filedAt,
    'keyword-heuristic chat analysis and contact attempts',
    'chat_summary',
    summary,
    {
      messageCount: chat.messageCount,
      callCount: chat.callCount,
      riderAgreementIds: chat.riderAgreementIds,
      riderRouteRequestIds: chat.riderRouteRequestIds,
      riderObjectionIds: chat.riderObjectionIds,
      threatIds: chat.threatIds,
      instructionLikeIds: chat.instructionLikeIds,
      sentimentCounts: { positive: counts.positive, neutral: counts.neutral, negative: counts.negative },
      driverContactAttemptsBeforeCancel: chat.driverContactAttemptsBeforeCancel,
      contactAttemptIds: chat.contactAttemptIds,
      minContactAttempts: chat.minContactAttempts,
      contactCheckMet: chat.contactCheckMet,
      tagMethod: 'keyword_heuristic',
    }
  );
}

function paymentRecords(fixture: Fixture, fare: FareCheck | null, basis: RemedyBasisEntry[] | null): Evidence[] {
  const payment = fixture.payment;
  if (payment.status !== 'available' || fare === null) return [];

  const lineItems = payment.lineItems.map(item => ({
    code: item.code,
    label: item.label,
    cents: item.cents,
    quantity: item.quantity ?? null,
  }));
  const itemsText = payment.lineItems.map(item => `${item.label} ${formatSgd(item.cents)}`).join(', ');
  const arithmetic = fare.arithmeticValid ? 'VALID' : `INVALID (${fare.anomalies.join(', ')})`;
  const fareRecord = envelope(
    fixture,
    'PAY-FARE',
    'payment',
    payment.paidAt,
    'integer-cent fare re-computation with divHalfUp',
    'fare_breakdown',
    `Fare ${formatSgd(payment.totalCents)}: ${itemsText}. Paid ${formatSgd(payment.paidCents)}. Arithmetic ${arithmetic}.`,
    {
      currency: payment.currency,
      rateCard: payment.rateCard,
      surgeMultiplierX100: payment.surgeMultiplierX100,
      lineItems,
      totalCents: payment.totalCents,
      paidCents: payment.paidCents,
      paidAt: payment.paidAt,
      arithmeticValid: fare.arithmeticValid,
      anomalies: fare.anomalies,
    }
  );

  if (basis === null) return [fareRecord];
  const basisText = basis
    .map(entry =>
      entry.eligibleCents === null
        ? `${entry.remedyId} unavailable (${entry.unavailableReason})`
        : `${entry.remedyId} ${formatSgd(entry.eligibleCents)}`
    )
    .join('; ');
  const remedyRecord = envelope(
    fixture,
    'PAY-REMEDY',
    'payment',
    fixture.filedAt,
    'RD-2 / NS-2 remedy formulas with divHalfUp',
    'remedy_basis',
    `Server-computed eligible amounts: ${basisText}. The Judge selects a remedy; the server pays the computed amount.`,
    { basis }
  );
  return [fareRecord, remedyRecord];
}

function historyRecords(fixture: Fixture): Evidence[] {
  return [
    historyRecord(fixture, 'HIST-RIDER', 'rider', fixture.history.rider),
    historyRecord(fixture, 'HIST-DRIVER', 'driver', fixture.history.driver),
  ];
}

function historyRecord(fixture: Fixture, id: string, party: 'rider' | 'driver', history: PartyHistory): Evidence {
  const label = party === 'rider' ? 'Rider' : 'Driver';
  const caveat = 'Context only; cannot establish fault.';
  const summary =
    `${label} ${history.partyId}: account ${history.accountAgeDays} days, rating ${history.rating}, ` +
    `${history.completedTrips} completed trips, ${history.disputesFiled90d} disputes filed and ` +
    `${history.disputesAgainst90d} against in the last 90 days. ${caveat}`;
  return envelope(fixture, id, 'history', fixture.filedAt, 'party history passthrough', 'party_history', summary, {
    party,
    partyId: history.partyId,
    accountAgeDays: history.accountAgeDays,
    rating: history.rating,
    completedTrips: history.completedTrips,
    disputesFiled90d: history.disputesFiled90d,
    disputesAgainst90d: history.disputesAgainst90d,
    caveat,
  });
}
