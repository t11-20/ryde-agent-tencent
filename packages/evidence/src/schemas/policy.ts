import { z } from "zod";
import { CATEGORIES, RemedyIdSchema } from "./dispute.js";

export const PolicyClauseSchema = z.strictObject({
  id: z.string().min(1),
  version: z.string(),
  category: z.enum([...CATEGORIES, "general"]),
  title: z.string(),
  text: z.string(),
  params: z.record(z.string(), z.number()),
  remedyCriteria: z.strictObject({ remedyId: RemedyIdSchema, when: z.string() }).nullable(),
});
export type PolicyClause = z.infer<typeof PolicyClauseSchema>;

export const PolicyDocSchema = z.strictObject({
  policyId: z.string(),
  version: z.string(),
  label: z.literal("DEMONSTRATION POLICY"),
  disclaimer: z.string(),
  currency: z.literal("SGD"),
  clauses: z.array(PolicyClauseSchema).min(1),
});
export type PolicyDoc = z.infer<typeof PolicyDocSchema>;
