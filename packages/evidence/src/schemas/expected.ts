import { z } from "zod";
import { CategorySchema, EvidenceFamilySchema, RemedyIdSchema } from "./dispute.js";

export const ExpectedOutcomeSchema = z.strictObject({
  fixtureId: z.string(),
  purpose: z.enum(["golden", "variation", "edge", "fairness", "robustness"]),
  category: CategorySchema,
  status: z.enum(["resolved", "incomplete"]),
  favours: z.enum(["rider", "driver"]).nullable(),
  remedyId: RemedyIdSchema.nullable(),
  amountCents: z.number().int().nonnegative().nullable(),
  decisiveEvidenceIds: z.array(z.string()),
  clauseIds: z.array(z.string()),
  missingFamilies: z.array(EvidenceFamilySchema),
  rationale: z.string(),
});
export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;
