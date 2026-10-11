import { z } from 'zod';
import { DisputeSchema, PolicyClauseSchema } from '@fairtrip/contracts';

const IsoUtc = z.iso.datetime();
const LatLng = z.tuple([z.number(), z.number()]);
const Place = z.strictObject({lat: z.number(), lng: z.number(), label: z.string().min(1)});
const Ping = z.strictObject({ts: IsoUtc, lat: z.number(), lng: z.number()});
const PartyHistory = z.strictObject({
  partyId: z.string().min(1), accountAgeDays: z.number().int().nonnegative(), rating: z.number(),
  completedTrips: z.number().int().nonnegative(), disputesFiled90d: z.number().int().nonnegative(), disputesAgainst90d: z.number().int().nonnegative()
});
const Unavailable = z.strictObject({status: z.literal('unavailable'), reason: z.string().min(1)});
export const GpsSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'),
    referenceRoute: z.strictObject({points: z.array(LatLng).min(2), estDurationSec: z.number().int().positive(), source: z.string().min(1)}).nullable(),
    driverTrace: z.array(Ping).min(1),
    reroutes: z.array(z.strictObject({ts: IsoUtc, reason: z.string().min(1), detail: z.string()})),
    advisories: z.array(z.strictObject({id: z.string().min(1), ts: IsoUtc, type: z.string().min(1), description: z.string(), source: z.string()}))
  }),
  Unavailable
]);
export const LineItemSchema = z.strictObject({
  code: z.enum(['base', 'distance', 'time', 'surge', 'promo', 'no_show_fee']), label: z.string().min(1), cents: z.number(), quantity: z.number().optional()
});
export const PaymentSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'), currency: z.string(),
    rateCard: z.strictObject({baseCents: z.number().int(), perKmCents: z.number().int(), perMinCents: z.number().int(), noShowFeeCents: z.number().int()}),
    surgeMultiplierX100: z.number().int().min(100), lineItems: z.array(LineItemSchema),
    totalCents: z.number(), paidCents: z.number(), paidAt: IsoUtc
  }),
  Unavailable
]);
export const FixtureSchema = z.strictObject({
  fixtureId: z.string().regex(/^[A-Z0-9]+$/), label: z.string().min(1), purpose: z.enum(['golden', 'variation', 'fairness', 'robustness']),
  dispute: DisputeSchema, filedAt: IsoUtc,
  trip: z.strictObject({pickup: Place, dropoff: Place.nullable(), startedAt: IsoUtc.nullable(), endedAt: IsoUtc.nullable(), driverMarkedArrivedAt: IsoUtc.nullable(), cancelledAt: IsoUtc.nullable()}),
  gps: GpsSchema,
  chat: z.strictObject({
    messages: z.array(z.strictObject({id: z.string().min(1), ts: IsoUtc, sender: z.enum(['rider', 'driver']), text: z.string()})),
    calls: z.array(z.strictObject({id: z.string().min(1), ts: IsoUtc, from: z.enum(['rider', 'driver']), to: z.enum(['rider', 'driver']), durationSec: z.number().int().nonnegative(), answered: z.boolean()}))
  }),
  payment: PaymentSchema,
  history: z.strictObject({rider: PartyHistory, driver: PartyHistory})
});
export type Fixture = z.infer<typeof FixtureSchema>;
export const PolicyDocSchema = z.strictObject({
  policyId: z.string().min(1), version: z.string().min(1), label: z.literal('DEMONSTRATION POLICY'), disclaimer: z.string().min(1),
  params: z.strictObject({minExcessMeters: z.number().int(), minExcessPercent: z.number().int(), maxPickupDistanceMeters: z.number().int(), minWaitSeconds: z.number().int(), minContactAttempts: z.number().int()}),
  clauses: z.array(PolicyClauseSchema).min(1)
});
export type PolicyDoc = z.infer<typeof PolicyDocSchema>;
export type PolicyParams = PolicyDoc['params'];
export const ExpectedOutcomeSchema = z.strictObject({
  fixtureId: z.string().min(1), purpose: z.enum(['golden', 'variation', 'fairness', 'robustness']), category: z.enum(['route_deviation', 'no_show']),
  expectedStatus: z.enum(['completed', 'incomplete']), expectedRuling: z.enum(['rider_favored', 'driver_favored']).nullable(),
  expectedRemedyId: z.enum(['keep_charge', 'refund_route_excess', 'refund_no_show_fee']).nullable(), expectedAmountCents: z.number().int().nonnegative().nullable(),
  decisiveEvidenceIds: z.array(z.string()), keyClauseIds: z.array(z.string()), missingFamilies: z.array(z.enum(['gps', 'chat', 'payment', 'history'])), rationale: z.string().min(1)
});
export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;
