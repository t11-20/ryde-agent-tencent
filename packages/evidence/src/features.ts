import { z } from 'zod';
import type { Dispute, Evidence } from '@fairtrip/contracts';

// Comparable case features, derived only from facts already present on the built
// records (never recomputed). Used for precedent matching. Stretch goal: precedent matching.
export const FEATURE_VOCABULARY: readonly string[] = [
  'rd1_exceeded', 'rd1_not_exceeded',
  'rider_agreement', 'rider_route_request', 'rider_objection', 'documented_reroute',
  'ns1_distance_met', 'ns1_distance_not_met',
  'ns1_wait_met', 'ns1_wait_not_met',
  'ns1_contact_met', 'ns1_contact_not_met',
  'location_claim',
];

// Polar feature pairs: a case asserting one side conflicts with any precedent
// asserting the opposite side.
export const FEATURE_OPPOSITES: Readonly<Record<string, string>> = {
  rd1_exceeded: 'rd1_not_exceeded',
  rd1_not_exceeded: 'rd1_exceeded',
  ns1_distance_met: 'ns1_distance_not_met',
  ns1_distance_not_met: 'ns1_distance_met',
  ns1_wait_met: 'ns1_wait_not_met',
  ns1_wait_not_met: 'ns1_wait_met',
  ns1_contact_met: 'ns1_contact_not_met',
  ns1_contact_not_met: 'ns1_contact_met',
};

const ChatMessageFacts = z.looseObject({
  kind: z.literal('chat_message'),
  tags: z.array(z.string()),
});
const RouteFacts = z.looseObject({
  kind: z.literal('route_metrics'),
  exceedsThreshold: z.boolean(),
});
const PickupFacts = z.looseObject({
  kind: z.literal('pickup_metrics'),
  checks: z.looseObject({ withinDistance: z.boolean(), waitedMinimum: z.boolean() }),
});
const ChatSummaryFacts = z.looseObject({
  kind: z.literal('chat_summary'),
  contactCheckMet: z.boolean().nullable(),
});
const GpsEventFacts = z.looseObject({
  kind: z.enum(['nav_event', 'traffic_advisory']),
});

function firstParsed<T>(evidence: Evidence[], schema: z.ZodType<T>): T | undefined {
  for (const record of evidence) {
    const parsed = schema.safeParse(record.facts);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}

/** Sorted, deduplicated feature strings for a dispute's evidence bundle. */
export function caseFeatures(evidence: Evidence[], category: Dispute['category']): string[] {
  const features = new Set<string>();
  const chatTags = new Set<string>();
  for (const record of evidence) {
    const message = ChatMessageFacts.safeParse(record.facts);
    if (message.success) for (const tag of message.data.tags) chatTags.add(tag);
  }

  if (category === 'route_deviation') {
    const route = firstParsed(evidence, RouteFacts);
    if (route !== undefined) features.add(route.exceedsThreshold ? 'rd1_exceeded' : 'rd1_not_exceeded');
    if (chatTags.has('agreement')) features.add('rider_agreement');
    if (chatTags.has('route_request')) features.add('rider_route_request');
    if (chatTags.has('objection')) features.add('rider_objection');
    if (evidence.some(record => GpsEventFacts.safeParse(record.facts).success)) features.add('documented_reroute');
  } else {
    const pickup = firstParsed(evidence, PickupFacts);
    if (pickup !== undefined) {
      features.add(pickup.checks.withinDistance ? 'ns1_distance_met' : 'ns1_distance_not_met');
      features.add(pickup.checks.waitedMinimum ? 'ns1_wait_met' : 'ns1_wait_not_met');
    }
    const summary = firstParsed(evidence, ChatSummaryFacts);
    if (summary !== undefined && summary.contactCheckMet !== null)
      features.add(summary.contactCheckMet ? 'ns1_contact_met' : 'ns1_contact_not_met');
    if (chatTags.has('location_claim')) features.add('location_claim');
  }

  return [...features].sort();
}
