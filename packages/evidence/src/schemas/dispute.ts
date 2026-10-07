import { z } from "zod";

/** ISO-8601 UTC timestamp at whole-second precision, e.g. "2026-10-02T11:05:00Z". */
export const IsoUtcSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "expected YYYY-MM-DDTHH:mm:ssZ");
export type IsoUtc = z.infer<typeof IsoUtcSchema>;

export const CATEGORIES = ["route_deviation", "no_show"] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

export const EVIDENCE_FAMILIES = ["gps", "chat", "payment", "history"] as const;
export const EvidenceFamilySchema = z.enum(EVIDENCE_FAMILIES);
export type EvidenceFamily = z.infer<typeof EvidenceFamilySchema>;

export const REMEDY_IDS = ["keep_charge", "refund_route_excess", "refund_no_show_fee"] as const;
export const RemedyIdSchema = z.enum(REMEDY_IDS);
export type RemedyId = z.infer<typeof RemedyIdSchema>;

export const LatLngSchema = z.tuple([z.number(), z.number()]);
export type LatLng = z.infer<typeof LatLngSchema>;

export const PingSchema = z.strictObject({ ts: IsoUtcSchema, lat: z.number(), lng: z.number() });
export type Ping = z.infer<typeof PingSchema>;

export const DisputeSchema = z.strictObject({
  id: z.string().min(1),
  category: CategorySchema,
  tripId: z.string().min(1),
  filedAt: IsoUtcSchema,
  riderClaim: z.string(),
  driverStatement: z.string(),
});
export type Dispute = z.infer<typeof DisputeSchema>;
