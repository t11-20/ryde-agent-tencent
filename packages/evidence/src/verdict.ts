import type { Dispute, Evidence, PolicyVerdict } from '@fairtrip/contracts';
import type { UnavailableFamily } from './build-evidence.js';

export type { PolicyVerdict, VerdictOutcome } from '@fairtrip/contracts';

// The deterministic verdict: the demonstration policy applied to the computed
// case features, with no model involved. A completed run whose Judge remedy
// diverges from this verdict must be escalated — nothing finalises silently.
const DECISIVE_FAMILIES: Evidence['source'][] = ['gps', 'payment'];
const INCOMPLETE_CLAUSE: Record<Dispute['category'], string> = {
  route_deviation: 'RD-6',
  no_show: 'NS-3',
};
const ROUTE_CONSENT = ['rider_agreement', 'rider_route_request'];
const NS1_CONDITIONS = ['ns1_distance', 'ns1_wait', 'ns1_contact'] as const;

function routeVerdict(features: readonly string[]): PolicyVerdict {
  const consent = features.filter(feature => ROUTE_CONSENT.includes(feature));
  if (features.includes('rd1_not_exceeded'))
    return {outcome: 'keep_charge', clauseIds: ['RD-1', 'RD-5'], basis: 'The measured detour did not exceed the RD-1 materiality threshold.', features: ['rd1_not_exceeded'], missingFamilies: []};
  if (!features.includes('rd1_exceeded'))
    return {outcome: 'undetermined', clauseIds: ['RD-1'], basis: 'No route metrics are available, so the RD-1 materiality check cannot be evaluated.', features: [], missingFamilies: []};
  if (consent.length > 0 && features.includes('rider_objection'))
    return {outcome: 'undetermined', clauseIds: ['RD-3'], basis: 'conflicting rider chat signals: consent and objection', features: [...consent, 'rider_objection'], missingFamilies: []};
  if (consent.length > 0)
    return {outcome: 'keep_charge', clauseIds: ['RD-1', 'RD-3'], basis: 'The rider consented to the route taken (agreement or route request in chat).', features: [...consent], missingFamilies: []};
  if (features.includes('documented_reroute'))
    return {outcome: 'keep_charge', clauseIds: ['RD-1', 'RD-4'], basis: 'A documented nav event or traffic advisory explains the departure from the reference route.', features: ['documented_reroute'], missingFamilies: []};
  return {outcome: 'refund_route_excess', clauseIds: ['RD-1', 'RD-2'], basis: 'Material detour with no rider consent and no documented reroute.', features: ['rd1_exceeded'], missingFamilies: []};
}

function noShowVerdict(features: readonly string[]): PolicyVerdict {
  const failed = NS1_CONDITIONS.filter(name => features.includes(`${name}_not_met`));
  if (failed.length > 0)
    return {
      outcome: 'refund_no_show_fee', clauseIds: ['NS-1', 'NS-2'],
      basis: `NS-1 conditions not met: ${failed.map(name => name.slice('ns1_'.length)).join(', ')}.`,
      features: failed.map(name => `${name}_not_met`), missingFamilies: []
    };
  if (NS1_CONDITIONS.every(name => features.includes(`${name}_met`)))
    return {outcome: 'keep_charge', clauseIds: ['NS-1'], basis: 'All three NS-1 pickup conditions (distance, wait, contact) were met.', features: NS1_CONDITIONS.map(name => `${name}_met`), missingFamilies: []};
  return {outcome: 'undetermined', clauseIds: ['NS-1'], basis: 'No pickup or contact metrics are available, so NS-1 cannot be evaluated.', features: [], missingFamilies: []};
}

export function policyVerdict(category: Dispute['category'], features: readonly string[], unavailable: readonly UnavailableFamily[]): PolicyVerdict {
  const missing = unavailable.filter(item => DECISIVE_FAMILIES.includes(item.family));
  if (missing.length > 0) {
    return {
      outcome: 'incomplete',
      clauseIds: [INCOMPLETE_CLAUSE[category]],
      basis: `Decisive evidence unavailable: ${missing.map(item => `${item.family} (${item.reason})`).join('; ')}.`,
      features: [],
      missingFamilies: missing.map(item => item.family),
    };
  }
  return category === 'route_deviation' ? routeVerdict(features) : noShowVerdict(features);
}
