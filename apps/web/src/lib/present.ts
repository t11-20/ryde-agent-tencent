// Presentation helpers: pure functions that turn contracts data into view-ready
// strings and gauge layouts. No React, no DOM.
import type { ActivityEvent, Evidence, PolicyClause, PolicyVerdict, Precedent, RiskAssessment, Run } from '@fairtrip/contracts';
import { elapsedSeconds } from './events.js';
import { actorLabel, eventLabel, formatSgd, percent, remedyLabel } from './format.js';
import type { PollPhase } from '../hooks/useRunPolling.js';
import type { EvidenceCard } from './view-model.js';

export type Facts = Evidence['facts'];

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
function arr(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}
function obj(value: unknown): Facts | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Facts : null;
}

const groupFormat = new Intl.NumberFormat('en-SG');

/** 2642 → "2,642". */
export function formatCount(n: number): string {
  return groupFormat.format(n);
}

/** plural(1, 'record', 'records') → "1 record". */
export function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

const categoryLabels: Record<string, string> = {
  route_deviation: 'Route deviation',
  no_show: 'No-show',
};

export function categoryLabel(category: string): string {
  return categoryLabels[category] ?? category;
}

const sgtFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** ISO timestamp → "HH:MM" 24-hour Asia/Singapore. */
export function sgtTime(iso: string): string {
  return sgtFormat.format(new Date(iso));
}

/** Short human label for an evidence record; falls back to the record id. */
export function evidenceLabel(card: Pick<EvidenceCard, 'id' | 'kind' | 'timestamp' | 'facts'>): string {
  switch (card.kind) {
    case 'route_metrics': return 'Route vs reference';
    case 'nav_event': return 'Navigation reroute';
    case 'traffic_advisory': return 'Traffic advisory';
    case 'pickup_metrics': return 'Pickup arrival and wait';
    case 'chat_message': {
      const sender = str(card.facts['sender']);
      if (sender === 'rider' || sender === 'driver') {
        return `${sender === 'rider' ? 'Rider' : 'Driver'} message ${sgtTime(card.timestamp)}`;
      }
      return card.id;
    }
    case 'call_log': {
      const from = str(card.facts['from']);
      if (from === 'rider' || from === 'driver') {
        return `${from === 'rider' ? 'Rider' : 'Driver'} call ${sgtTime(card.timestamp)}`;
      }
      return card.id;
    }
    case 'chat_summary': return 'Chat summary';
    case 'fare_breakdown': return 'Fare breakdown';
    case 'remedy_basis': return 'Refund calculation';
    case 'party_history': {
      const party = str(card.facts['party']);
      if (party === 'rider' || party === 'driver') {
        return `${party === 'rider' ? 'Rider' : 'Driver'} history`;
      }
      return card.id;
    }
    default: return card.id;
  }
}

const clauseLabels: Record<string, string> = {
  'RD-1': 'Material detour test',
  'RD-2': 'Refund excess distance',
  'RD-3': 'Rider approved route',
  'RD-4': 'Documented diversion',
  'RD-5': 'Not material',
  'RD-6': 'Missing decisive evidence',
  'RD-7': 'History is context only',
  'NS-1': 'No-show fee conditions',
  'NS-2': 'Refund no-show fee',
  'NS-3': 'Missing decisive evidence',
  'NS-4': 'History is context only',
};

export function clauseLabel(id: string): string {
  return clauseLabels[id] ?? id;
}

/** Text up to and including the first sentence terminator (so "S$1.98" stays whole). */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === '.' || ch === '!' || ch === '?') {
      const next = trimmed[i + 1];
      if (next === undefined || /\s/.test(next)) return trimmed.slice(0, i + 1);
    }
  }
  return trimmed;
}

export function actionHeadline(action: {recipient: 'rider' | 'driver' | 'none'; amountCents: number}): string {
  if (action.recipient === 'rider') return `Refund ${formatSgd(action.amountCents)} to the rider`;
  if (action.recipient === 'driver') return `Pay ${formatSgd(action.amountCents)} to the driver`;
  return `Keep the charge: ${formatSgd(action.amountCents)} refunded`;
}

export const STAGES = ['Filed', 'Gathering evidence', 'Cases submitted', 'Judge deliberating', 'Ruling'] as const;

/** Furthest stage reached, as an index into STAGES. */
export function stageOf(events: ActivityEvent[]): number {
  let sawTerminal = false;
  let sawJudge = false;
  let riderCase = false;
  let driverCase = false;
  let advocatesActive = false;
  for (const event of events) {
    if (event.type === 'run.completed' || event.type === 'run.incomplete' || event.type === 'run.failed') sawTerminal = true;
    if (event.type === 'judge.started' || event.actor === 'judge') sawJudge = true;
    if (event.type === 'case.completed') {
      if (event.actor === 'rider') riderCase = true;
      if (event.actor === 'driver') driverCase = true;
    }
    if (event.actor === 'rider' || event.actor === 'driver') advocatesActive = true;
  }
  if (sawTerminal) return 4;
  if (sawJudge) return 3;
  if (riderCase && driverCase) return 2;
  return advocatesActive ? 1 : 0;
}

/** Cited clauses first, in policy order; the rest follow in the same order. */
export function partitionClauses(policies: PolicyClause[], citedIds: string[]): {cited: PolicyClause[]; rest: PolicyClause[]} {
  const citedSet = new Set(citedIds);
  const cited: PolicyClause[] = [];
  const rest: PolicyClause[] = [];
  for (const clause of policies) (citedSet.has(clause.id) ? cited : rest).push(clause);
  return {cited, rest};
}

/** Map an error code/message to a plain-language title, explanation and retry flag. */
export function describeError(code: string, message: string): {title: string; sentence: string; retry: boolean} {
  const text = `${code} ${message}`.toLowerCase();
  const match = (needles: string[]): boolean => needles.some(needle => text.includes(needle));
  if (match(['http 529', 'overloaded', 'http 503'])) {
    return {title: 'The AI model is overloaded', sentence: 'The model provider is handling a surge. This usually clears within a few minutes.', retry: true};
  }
  if (match(['http 429'])) {
    return {title: "The model's rate limit was reached", sentence: 'Too many requests on the shared plan. Wait a minute, then try again.', retry: true};
  }
  if (match(['http 401', 'http 403'])) {
    return {title: 'The model key was rejected', sentence: "Check MODEL_API_KEY in the API's .env, then restart the API.", retry: false};
  }
  if (match(['http 404'])) {
    return {title: 'The model or endpoint was not found', sentence: "Check MODEL_NAME and MODEL_BASE_URL in the API's .env.", retry: false};
  }
  if (match(['deadline exceeded', 'aborted', 'timed out'])) {
    return {title: 'The model took too long', sentence: "Each run has 90 seconds. Try again; if it keeps happening, turn the model's thinking off (see harness/TROUBLESHOOTING.md).", retry: true};
  }
  if (match(['unparseable', 'repair'])) {
    return {title: "The model's answer could not be read", sentence: 'It did not return valid JSON. Try again.', retry: true};
  }
  return {title: 'The run failed', sentence: firstSentence(message), retry: true};
}

export type PageState = 'idle' | 'running' | 'completed' | 'incomplete' | 'failed' | 'stopped' | 'contract_mismatch' | 'connection_lost';

/** The one state the page is in, from the polling phase plus the run status. */
export function pageState(phase: PollPhase, status: Run['status'] | null): PageState {
  switch (phase) {
    case 'idle': return 'idle';
    case 'starting':
    case 'polling': return 'running';
    case 'start_failed': return 'failed';
    case 'stopped': return 'stopped';
    case 'contract_mismatch': return 'contract_mismatch';
    case 'connection_lost': return 'connection_lost';
    case 'done':
      if (status === 'completed') return 'completed';
      if (status === 'incomplete') return 'incomplete';
      if (status === 'failed') return 'failed';
      return 'running';
  }
}

/** Seconds the run lasted, or null when there are no events. */
export function stoppedAfterSeconds(events: ActivityEvent[]): number | null {
  const last = events[events.length - 1];
  if (last === undefined) return null;
  return elapsedSeconds(events, last);
}

/** 1.4 → "1.4". */
export function formatSeconds(s: number): string {
  return s.toFixed(1);
}

export const START_SNAP_SECONDS = 0.3;
export type HearingLane = 'rider' | 'judge' | 'driver' | 'risk';
export const HEARING_LANES: readonly HearingLane[] = ['rider', 'judge', 'driver', 'risk'];

export interface HearingStation {
  sequence: number;
  lane: HearingLane;
  actor: ActivityEvent['actor'];
  type: ActivityEvent['type'];
  seconds: number;
  x: number;
  title: string;
}

export interface HearingGeometry {
  domainSeconds: number;
  ticks: {seconds: number; x: number; label: string}[];
  rails: {lane: HearingLane; x1: 0; x2: 100}[];
  segments: {lane: HearingLane; x1: number; x2: number}[];
  stations: HearingStation[];
  handoff: {x: number; seconds: number; title: string; risk: boolean} | null;
  end: {kind: 'ruling' | 'incomplete' | 'failed'; x: number; seconds: number; label: string; title: string} | null;
}

function hearingLaneOf(actor: ActivityEvent['actor']): HearingLane {
  if (actor === 'rider') return 'rider';
  if (actor === 'driver') return 'driver';
  if (actor === 'risk') return 'risk';
  return 'judge';
}

/** Static geometry for the hearing-lines figure; x is 0–100 across the plot. */
export function hearingGeometry(events: ActivityEvent[], status: Run['status'] | null): HearingGeometry {
  const lastEvent = events[events.length - 1];
  const lastSeconds = lastEvent === undefined ? 0 : Math.max(0, elapsedSeconds(events, lastEvent));
  const domainSeconds = Math.max(20, lastSeconds + 2);
  const px100 = (seconds: number): number => (seconds / domainSeconds) * 100;

  const step = domainSeconds <= 60 ? 5 : 10;
  const ticks: HearingGeometry['ticks'] = [];
  for (let t = 0; t <= domainSeconds; t += step) {
    ticks.push({seconds: t, x: px100(t), label: `${String(t)} s`});
  }

  const rails = HEARING_LANES.map(lane => ({lane, x1: 0 as const, x2: 100 as const}));

  const secondsOf = (event: ActivityEvent): number => Math.max(0, elapsedSeconds(events, event));
  // Drawing only: the agents are all dispatched at run start, so stations within
  // the first START_SNAP_SECONDS share the 0 s mark instead of showing clock jitter.
  // Titles keep the exact time.
  const drawX = (seconds: number): number => px100(seconds <= START_SNAP_SECONDS ? 0 : seconds);
  const handoffEvent = events.find(event => event.type === 'judge.started');
  const handoffSeconds = handoffEvent === undefined ? 0 : secondsOf(handoffEvent);
  const hasRiskStations = events.some(event => event.actor === 'risk');
  const handoff = handoffEvent === undefined ? null : {
    x: px100(handoffSeconds),
    seconds: handoffSeconds,
    title: `Judge: Handoff to the Judge, +${formatSeconds(handoffSeconds)} s`,
    risk: hasRiskStations,
  };

  let end: HearingGeometry['end'] = null;
  if (lastEvent !== undefined && (status === 'completed' || status === 'incomplete' || status === 'failed')) {
    const seconds = secondsOf(lastEvent);
    const x = px100(seconds);
    if (status === 'completed') {
      end = {kind: 'ruling', x, seconds, label: 'Ruling', title: `Ruling, +${formatSeconds(seconds)} s`};
    } else if (status === 'incomplete') {
      end = {kind: 'incomplete', x, seconds, label: 'Incomplete', title: `Incomplete, +${formatSeconds(seconds)} s`};
    } else {
      const label = `Failed at ${formatSeconds(seconds)} s`;
      end = {kind: 'failed', x, seconds, label, title: label};
    }
  }

  const stations: HearingStation[] = [];
  const segments: HearingGeometry['segments'] = [];
  const spans = new Map<HearingLane, {first: number; last: number}>();
  for (const event of events) {
    const lane = hearingLaneOf(event.actor);
    const seconds = secondsOf(event);
    const x = drawX(seconds);
    const isHandoff = event === handoffEvent;
    const isEnd = end !== null && event === lastEvent;
    if (!isHandoff && !isEnd) {
      const title = event.actor === 'risk'
        ? `Risk Analyst: ${event.summary}, +${formatSeconds(seconds)} s`
        : event.actor === 'precedent'
          ? `Precedent: ${event.summary}, +${formatSeconds(seconds)} s`
          : `${actorLabel(event.actor)}: ${eventLabel(event.type)}, +${formatSeconds(seconds)} s`;
      stations.push({sequence: event.sequence, lane, actor: event.actor, type: event.type, seconds, x, title});
    }
    if (event.actor === 'rider' || event.actor === 'driver') {
      const span = spans.get(lane) ?? {first: x, last: x};
      span.last = x;
      spans.set(lane, span);
    }
  }
  for (const lane of HEARING_LANES) {
    const span = spans.get(lane);
    if (span !== undefined) segments.push({lane, x1: span.first, x2: span.last});
  }
  const judgeXs = events.filter(event => event.actor === 'judge').map(event => px100(secondsOf(event)));
  if (judgeXs.length > 0) {
    const x1 = judgeXs[0] ?? 0;
    const x2 = Math.max(judgeXs[judgeXs.length - 1] ?? 0, end === null ? 0 : end.x);
    segments.push({lane: 'judge', x1, x2});
  }
  const riskXs = events.filter(event => event.actor === 'risk').map(event => drawX(secondsOf(event)));
  if (riskXs.length > 0) {
    segments.push({lane: 'risk', x1: riskXs[0] ?? 0, x2: riskXs[riskXs.length - 1] ?? 0});
  }

  return {domainSeconds, ticks, rails, segments, stations, handoff, end};
}

export interface RouteGauge {
  referenceMeters: number;
  actualMeters: number;
  excessMeters: number;
  thresholdMeters: number;
  exceeded: boolean;
  stops: number;
  referencePct: number;
  actualPct: number;
  markerPct: number;
  actualWithinPct: number;
  actualBeyondPct: number;
  caption: string;
}

/** Bar layout for the route-vs-reference record; positions only, numbers come from facts. */
export function routeGauge(facts: Facts | null | undefined): RouteGauge | null {
  if (facts === null || facts === undefined || str(facts['kind']) !== 'route_metrics') return null;
  const referenceMeters = num(facts['referenceMeters']);
  const actualMeters = num(facts['actualMeters']);
  const excessMeters = num(facts['excessMeters']);
  const thresholdMeters = num(facts['thresholdMeters']);
  const exceeded = bool(facts['exceedsThreshold']);
  const stops = arr(facts['unexpectedStops']);
  if (referenceMeters === null || actualMeters === null || excessMeters === null ||
      thresholdMeters === null || exceeded === null || stops === null) return null;
  const scale = Math.max(actualMeters, referenceMeters + thresholdMeters, 1);
  const pct = (v: number): number => (v / scale) * 100;
  const tail = `RD-1 threshold ${formatCount(thresholdMeters)} m: ${exceeded ? 'exceeded' : 'not exceeded'}`;
  const caption = excessMeters >= 0
    ? `+${formatCount(excessMeters)} m over the reference; ${tail}`
    : `${formatCount(-excessMeters)} m under the reference; ${tail}`;
  const actualPct = pct(actualMeters);
  const markerPct = pct(referenceMeters + thresholdMeters);
  return {
    referenceMeters, actualMeters, excessMeters, thresholdMeters, exceeded,
    stops: stops.length,
    referencePct: pct(referenceMeters),
    actualPct,
    markerPct,
    actualWithinPct: Math.min(actualPct, markerPct),
    actualBeyondPct: Math.max(0, actualPct - markerPct),
    caption,
  };
}

export interface Meter {
  label: string;
  valueText: string;
  limitText: string;
  met: boolean;
  valuePct: number | null;
  limitPct: number;
}

export interface PickupGauge {
  distance: Meter;
  wait: Meter;
  contact: Meter | null;
}

function meterScale(value: number | null, limit: number): number {
  return Math.max(value ?? 0, limit, 1) * 1.25;
}

/** Meter layout for the no-show pickup record, plus contact attempts from the chat summary. */
export function pickupGauge(pickup: Facts | null | undefined, chatSummary: Facts | null | undefined): PickupGauge | null {
  if (pickup === null || pickup === undefined || str(pickup['kind']) !== 'pickup_metrics') return null;
  const closest = num(pickup['closestApproachMeters']);
  const maxDistance = num(pickup['maxPickupDistanceMeters']);
  const minWait = num(pickup['minWaitSeconds']);
  const rawWait = pickup['waitSecondsWithinThreshold'];
  const wait = rawWait === null ? null : num(rawWait);
  const checks = obj(pickup['checks']);
  const withinDistance = bool(checks?.['withinDistance']);
  const waitedMinimum = bool(checks?.['waitedMinimum']);
  if (closest === null || maxDistance === null || minWait === null ||
      (rawWait !== null && wait === null) || withinDistance === null || waitedMinimum === null) return null;

  const distanceScale = meterScale(closest, maxDistance);
  const distance: Meter = {
    label: 'Closest approach',
    valueText: `${formatCount(closest)} m`,
    limitText: `Limit ${formatCount(maxDistance)} m`,
    met: withinDistance,
    valuePct: (closest / distanceScale) * 100,
    limitPct: (maxDistance / distanceScale) * 100,
  };

  const waitScale = meterScale(wait, minWait);
  const waitMeter: Meter = {
    label: 'Wait within range',
    valueText: wait === null ? 'Never within range' : `${formatCount(wait)} s`,
    limitText: `Minimum ${formatCount(minWait)} s`,
    met: waitedMinimum,
    valuePct: wait === null ? null : (wait / waitScale) * 100,
    limitPct: (minWait / waitScale) * 100,
  };

  let contact: Meter | null = null;
  if (chatSummary !== null && chatSummary !== undefined && str(chatSummary['kind']) === 'chat_summary') {
    const minAttempts = num(chatSummary['minContactAttempts']);
    if (minAttempts !== null) {
      const rawAttempts = chatSummary['driverContactAttemptsBeforeCancel'];
      const attempts = rawAttempts === null ? null : num(rawAttempts);
      if (rawAttempts === null || attempts !== null) {
        const met = bool(chatSummary['contactCheckMet']) === true;
        const contactScale = meterScale(attempts, minAttempts);
        contact = {
          label: 'Contact attempts',
          valueText: attempts === null ? 'None recorded' : plural(attempts, 'attempt', 'attempts'),
          limitText: `Minimum ${formatCount(minAttempts)}`,
          met,
          valuePct: attempts === null ? null : (attempts / contactScale) * 100,
          limitPct: (minAttempts / contactScale) * 100,
        };
      }
    }
  }

  return {distance, wait: waitMeter, contact};
}

export interface PaymentView {
  lineItems: {label: string; amount: string}[];
  total: string;
  paid: string;
  remedies: {remedyId: string; label: string; amount: string | null; note: string | null}[];
}

/** Fare breakdown plus server-computed remedy amounts for the payment record. */
export function paymentGauge(fare: Facts | null | undefined, remedy: Facts | null | undefined): PaymentView | null {
  if (fare === null || fare === undefined || str(fare['kind']) !== 'fare_breakdown') return null;
  const rawItems = arr(fare['lineItems']);
  const totalCents = num(fare['totalCents']);
  const paidCents = num(fare['paidCents']);
  if (rawItems === null || totalCents === null || paidCents === null) return null;
  const lineItems: {label: string; amount: string}[] = [];
  for (const raw of rawItems) {
    const item = obj(raw);
    if (item === null) continue;
    const label = str(item['label']);
    const cents = num(item['cents']);
    if (label === null || cents === null) continue;
    lineItems.push({label, amount: formatSgd(cents)});
  }
  const remedies: PaymentView['remedies'] = [];
  if (remedy !== null && remedy !== undefined && str(remedy['kind']) === 'remedy_basis') {
    const basis = arr(remedy['basis']);
    if (basis !== null) {
      for (const raw of basis) {
        const entry = obj(raw);
        if (entry === null) continue;
        const remedyId = str(entry['remedyId']);
        if (remedyId === null) continue;
        const eligible = num(entry['eligibleCents']);
        const note = str(entry['unavailableReason']);
        remedies.push({
          remedyId,
          label: remedyLabel(remedyId),
          amount: eligible === null ? null : formatSgd(eligible),
          note,
        });
      }
    }
  }
  return {lineItems, total: formatSgd(totalCents), paid: formatSgd(paidCents), remedies};
}

/* Stretch goals: risk, precedents, escalation and human review. */

/** Actor label for the new actors; the label map in format.ts predates them. */
export function actorDisplay(actor: ActivityEvent['actor']): string {
  if (actor === 'risk') return 'Risk Analyst';
  if (actor === 'precedent') return 'Precedent';
  return actorLabel(actor);
}

/** Event label for the new event types; format.ts predates them. */
export function eventDisplay(type: ActivityEvent['type']): string {
  switch (type) {
    case 'risk.assessed': return 'Risk assessed';
    case 'precedent.retrieved': return 'Precedents retrieved';
    case 'run.escalated': return 'Escalated for human review';
    case 'review.decided': return 'Review decided';
    default: return eventLabel(type);
  }
}

export type ReviewState = 'none' | 'pending' | 'decided';

/** Where a run stands with respect to human review. */
export function reviewState(run: Run): ReviewState {
  if (run.status !== 'completed' || run.escalation === undefined) return 'none';
  return run.review === undefined ? 'pending' : 'decided';
}

/** Outcome label for the deterministic policy verdict — not every outcome is a remedy. */
export function verdictOutcomeLabel(outcome: PolicyVerdict['outcome']): string {
  switch (outcome) {
    case 'keep_charge': return remedyLabel('keep_charge');
    case 'refund_route_excess': return remedyLabel('refund_route_excess');
    case 'refund_no_show_fee': return remedyLabel('refund_no_show_fee');
    case 'incomplete': return 'Incomplete — decisive evidence missing';
    case 'undetermined': return 'Undetermined by the policy rules';
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

/** One plain sentence per escalation reason, for the bench. Exhaustive over the enum. */
export function escalationLines(run: Run): string[] {
  if (run.status !== 'completed' || run.escalation === undefined) return [];
  const escalation = run.escalation;
  return escalation.reasons.map(reason => {
    switch (reason) {
      case 'high_risk':
        return run.risk === undefined ? 'High risk' : `Risk ${run.risk.overall} — ${run.risk.summary}`;
      case 'low_confidence':
        return `Judge confidence ${escalation.confidence.toFixed(2)} is below the ${escalation.threshold} review threshold`;
      case 'policy_divergence': {
        const divergence = run.divergence;
        const verdict = run.verdict;
        if (divergence === undefined || verdict === undefined)
          return 'The Judge ruling differs from the deterministic policy verdict.';
        return `The policy rules give ${verdictOutcomeLabel(divergence.verdictOutcome)} under ${verdict.clauseIds.join(', ')}; the Judge chose ${remedyLabel(divergence.judgeRemedyId)}. Nothing is paid until a reviewer decides.`;
      }
      case 'policy_undetermined':
        return `The policy rules could not determine this case${run.verdict === undefined ? '' : ` (${run.verdict.basis})`}; the Judge's ruling is a recommendation until a reviewer decides.`;
      default: {
        const exhaustive: never = reason;
        return exhaustive;
      }
    }
  });
}

/** Headline for the review state; divergent rulings are called out by name. */
export function reviewHeadline(run: Run): string {
  return run.status === 'completed' && run.divergence !== undefined
    ? 'Sent to human review — Judge disagrees with the policy rules'
    : 'Sent to human review';
}

/** Two-line comparison shown on the bench when the Judge diverges from the verdict. */
export function divergenceComparison(run: Run): {policy: string; judge: string} | null {
  if (run.status !== 'completed' || run.divergence === undefined || run.verdict === undefined) return null;
  return {
    policy: `Policy rules: ${verdictOutcomeLabel(run.divergence.verdictOutcome)} (${run.verdict.clauseIds.join(', ')})`,
    judge: `Judge: ${remedyLabel(run.divergence.judgeRemedyId)} · confidence ${percent(run.result.confidence)}`,
  };
}

/** The verdict outcome as an applyable remedy — only when it is a remedy that differs from the Judge's. */
export function policyVerdictRemedy(run: Run): RemedyOption['id'] | null {
  if (run.status !== 'completed' || run.verdict === undefined) return null;
  const outcome = run.verdict.outcome;
  if (outcome === 'incomplete' || outcome === 'undetermined') return null;
  return outcome === run.result.action.remedyId ? null : outcome;
}

/** One-line policy-verdict summary for the Judge column. */
export function verdictLine(verdict: PolicyVerdict): string {
  return `${verdictOutcomeLabel(verdict.outcome)} — ${verdict.clauseIds.join(', ')} — ${verdict.basis}`;
}

/** 'Judge agrees with the policy rules.' when a completed ruling equals the verdict outcome. */
export function verdictAgreement(verdict: PolicyVerdict | undefined, remedyId: string | null): string | null {
  if (verdict === undefined || remedyId === null) return null;
  return verdict.outcome === remedyId ? 'Judge agrees with the policy rules.' : null;
}

/** Bench note for a run that is the API's automatic re-run after a failed first attempt. */
export function retryNote(errorMessage: string): string {
  const kind = /timeout/i.test(errorMessage) ? 'provider timeout' : 'workflow failure';
  return `First attempt failed (${kind}); this is the automatic re-run.`;
}

export interface RemedyOption {id: 'keep_charge' | 'refund_route_excess' | 'refund_no_show_fee'; label: string}

/** Remedies a reviewer may apply, per dispute category. */
export function remedyOptions(category: Run['dispute']['category']): RemedyOption[] {
  const ids: RemedyOption['id'][] = category === 'no_show'
    ? ['keep_charge', 'refund_no_show_fee']
    : ['keep_charge', 'refund_route_excess'];
  return ids.map(id => ({id, label: remedyLabel(id)}));
}

const riskLevelLabels: Record<RiskAssessment['overall'], string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

export function riskLevelLabel(overall: RiskAssessment['overall']): string {
  return riskLevelLabels[overall];
}

const signalLabels: Record<string, string> = {
  frequent_filer: 'Frequent filer',
  repeat_subject: 'Repeated complaints against',
  low_rating: 'Low rating',
  new_account: 'New account',
  instruction_like_chat: 'Instruction-like chat',
  threat_in_chat: 'Threat in chat',
};

export function signalLabel(code: string): string {
  return signalLabels[code] ?? code;
}

const precedentOriginLabels: Record<Precedent['origin'], string> = {
  seed: 'Seed case',
  run: 'Earlier run',
  human_override: 'Human override',
};

export function precedentOriginLabel(origin: Precedent['origin']): string {
  return precedentOriginLabels[origin];
}
