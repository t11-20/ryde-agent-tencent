import { z } from "zod";
import { DisputeSchema, IsoUtcSchema, LatLngSchema, PingSchema } from "./dispute.js";

export const PlaceSchema = z.strictObject({ lat: z.number(), lng: z.number(), label: z.string() });
export type Place = z.infer<typeof PlaceSchema>;

export const PartyHistorySchema = z.strictObject({
  partyId: z.string(),
  accountAgeDays: z.number(),
  rating: z.number(),
  completedTrips: z.number(),
  disputesFiled90d: z.number(),
  disputesAgainst90d: z.number(),
});
export type PartyHistory = z.infer<typeof PartyHistorySchema>;

export const GpsEventSchema = z.strictObject({
  ts: IsoUtcSchema,
  type: z.enum(["trip_start", "trip_end", "driver_marked_arrived", "driver_cancelled_no_show", "reroute"]),
  reason: z.string().optional(),
  detail: z.string().optional(),
});
export type GpsEvent = z.infer<typeof GpsEventSchema>;

export const TrafficAdvisorySchema = z.strictObject({
  id: z.string(),
  ts: IsoUtcSchema,
  type: z.enum(["road_closure", "lane_closure", "police_diversion"]),
  description: z.string(),
  source: z.string(),
});
export type TrafficAdvisory = z.infer<typeof TrafficAdvisorySchema>;

export const ReferenceRouteSchema = z.strictObject({
  points: z.array(LatLngSchema).min(2),
  estDurationSec: z.number(),
  source: z.string(),
});

export const GpsAvailableSchema = z.strictObject({
  status: z.literal("available"),
  referenceRoute: ReferenceRouteSchema.optional(),
  driverTrace: z.array(PingSchema),
  riderTrace: z.array(PingSchema).optional(),
  events: z.array(GpsEventSchema),
  trafficAdvisories: z.array(TrafficAdvisorySchema),
});
export type GpsAvailable = z.infer<typeof GpsAvailableSchema>;

export const UnavailableSchema = z.strictObject({ status: z.literal("unavailable"), reason: z.string() });

export const GpsSchema = z.discriminatedUnion("status", [GpsAvailableSchema, UnavailableSchema]);

export const MessageSchema = z.strictObject({
  id: z.string(),
  ts: IsoUtcSchema,
  sender: z.enum(["rider", "driver"]),
  text: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const CallSchema = z.strictObject({
  id: z.string(),
  ts: IsoUtcSchema,
  from: z.enum(["rider", "driver"]),
  to: z.enum(["rider", "driver"]),
  durationSec: z.number(),
  answered: z.boolean(),
});
export type Call = z.infer<typeof CallSchema>;

export const LINE_ITEM_CODES = ["base", "distance", "time", "surge", "promo", "no_show_fee"] as const;

/** Money fields are `number` (not int) on purpose: the fare validator reports bad values as anomalies. */
export const LineItemSchema = z.strictObject({
  code: z.enum(LINE_ITEM_CODES),
  label: z.string(),
  cents: z.number(),
  quantity: z.number().optional(),
  unit: z.enum(["m", "s"]).optional(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const RateCardSchema = z.strictObject({
  baseCents: z.number(),
  perKmCents: z.number(),
  perMinCents: z.number(),
  noShowFeeCents: z.number(),
});
export type RateCard = z.infer<typeof RateCardSchema>;

export const PaymentAvailableSchema = z.strictObject({
  status: z.literal("available"),
  currency: z.string(),
  rateCard: RateCardSchema,
  surgeMultiplierX100: z.number(),
  lineItems: z.array(LineItemSchema),
  totalCents: z.number(),
  paidCents: z.number(),
  paidAt: IsoUtcSchema,
});
export type PaymentAvailable = z.infer<typeof PaymentAvailableSchema>;

export const PaymentSchema = z.discriminatedUnion("status", [PaymentAvailableSchema, UnavailableSchema]);

export const TripFixtureSchema = z.strictObject({
  fixtureId: z.string().regex(/^[A-Z0-9]+$/),
  label: z.string(),
  purpose: z.enum(["golden", "variation", "edge", "fairness", "robustness"]),
  synthetic: z.literal(true),
  dispute: DisputeSchema,
  parties: z.strictObject({ riderId: z.string(), driverId: z.string() }),
  trip: z.strictObject({
    pickup: PlaceSchema,
    dropoff: PlaceSchema.nullable(),
    requestedAt: IsoUtcSchema,
    outcome: z.enum(["completed", "cancelled_no_show"]),
  }),
  gps: GpsSchema,
  comms: z.strictObject({ messages: z.array(MessageSchema), calls: z.array(CallSchema) }),
  payment: PaymentSchema,
  history: z.strictObject({ rider: PartyHistorySchema, driver: PartyHistorySchema }),
});
export type TripFixture = z.infer<typeof TripFixtureSchema>;
export type FixturePurpose = TripFixture["purpose"];
