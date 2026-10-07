import { z } from "zod";
import { EvidenceFamilySchema, IsoUtcSchema, RemedyIdSchema } from "./dispute.js";

export const EVIDENCE_KINDS = [
  "route_metrics",
  "nav_event",
  "traffic_advisory",
  "pickup_metrics",
  "rider_location",
  "chat_message",
  "call_log",
  "contact_summary",
  "fare_breakdown",
  "remedy_basis",
  "party_history",
] as const;
export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const ProvenanceSchema = z.strictObject({
  source: z.literal("synthetic_fixture"),
  fixtureId: z.string(),
  fields: z.array(z.string()),
  method: z.string(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/**
 * Wire shape of an evidence record. `facts` is typed per kind in TypeScript
 * (see `src/adapters`); on the wire it is validated as a plain object.
 */
export const EvidenceRecordSchema = z.object({
  id: z.string().min(1),
  family: EvidenceFamilySchema,
  kind: EvidenceKindSchema,
  timestamp: IsoUtcSchema.nullable(),
  summary: z.string(),
  facts: z.record(z.string(), z.unknown()),
  provenance: ProvenanceSchema,
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const RemedyBasisSchema = z.strictObject({
  remedyId: RemedyIdSchema,
  eligibleCents: z.number().int().nonnegative().nullable(),
  formula: z.string(),
  unavailableReason: z.string().optional(),
});
export type RemedyBasis = z.infer<typeof RemedyBasisSchema>;

export const UnavailableFamilySchema = z.strictObject({ family: EvidenceFamilySchema, reason: z.string() });
export type UnavailableFamily = z.infer<typeof UnavailableFamilySchema>;
