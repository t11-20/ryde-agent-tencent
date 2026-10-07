// PROVISIONAL mirror of Lane A contracts. Replace with Lane A's package at integration.
//
// Every response is parsed with loose objects (Zod 4's `.passthrough()`): unknown keys are kept,
// unknown event types and actors are accepted and rendered generically.
import {
  CategorySchema,
  DisputeSchema,
  EvidenceFamilySchema,
  EvidenceRecordSchema,
  IsoUtcSchema,
  PolicyClauseSchema,
  RemedyIdSchema,
} from "@fairtrip/evidence";
import { z } from "zod";

export const RunStatusSchema = z.enum(["queued", "running", "completed", "incomplete", "failed"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;
export const TERMINAL_STATUSES: readonly RunStatus[] = ["completed", "incomplete", "failed"];
export const isTerminal = (s: RunStatus): boolean => TERMINAL_STATUSES.includes(s);

export const KNOWN_ACTORS = ["controller", "rider_advocate", "driver_advocate", "judge", "validator"] as const;
export const KNOWN_EVENT_TYPES = [
  "run_started", "tool_requested", "tool_result", "case_submitted", "case_rejected", "handoff_to_judge", "judge_started",
  "ruling_issued", "validation_passed", "validation_failed", "run_completed", "run_incomplete", "run_failed",
] as const;

export const ActivityEventSchema = z.looseObject({
  runId: z.string(),
  sequence: z.number().int(),
  timestamp: z.string(),
  actor: z.string(),
  type: z.string(),
  summary: z.string(),
  refs: z.looseObject({ evidenceIds: z.array(z.string()).optional(), policyIds: z.array(z.string()).optional() }).optional(),
  data: z.unknown().optional(),
  dev: z.boolean().optional(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const CitedPointSchema = z.looseObject({
  point: z.string(),
  evidenceIds: z.array(z.string()),
  policyIds: z.array(z.string()),
});
export type CitedPoint = z.infer<typeof CitedPointSchema>;

export const AdvocateCaseSchema = z.looseObject({
  side: z.enum(["rider", "driver"]),
  summary: z.string(),
  arguments: z.array(CitedPointSchema),
  counterevidence: z.array(CitedPointSchema),
  requestedRemedy: RemedyIdSchema,
  missingFacts: z.array(z.string()),
});
export type AdvocateCase = z.infer<typeof AdvocateCaseSchema>;

export const JudgeResultSchema = z.looseObject({
  ruling: z.string(),
  findings: z.array(CitedPointSchema),
  remedyId: RemedyIdSchema.nullable(),
  confidence: z.number(),
  reasoning: z.string(),
  riderExplanation: z.string(),
  driverExplanation: z.string(),
});
export type JudgeResult = z.infer<typeof JudgeResultSchema>;

export const FinalActionSchema = z.looseObject({
  remedyId: RemedyIdSchema,
  recipient: z.literal("rider").nullable(),
  currency: z.literal("SGD"),
  amountCents: z.number().int(),
  text: z.string(),
});
export type FinalAction = z.infer<typeof FinalActionSchema>;

export const MissingEvidenceSchema = z.looseObject({ family: EvidenceFamilySchema, reason: z.string() });

export const RunViewSchema = z.looseObject({
  runId: z.string(),
  status: RunStatusSchema,
  events: z.array(ActivityEventSchema),
  dispute: DisputeSchema.loose().optional(),
  evidence: z.array(EvidenceRecordSchema.loose()).optional(),
  policyClauses: z.array(PolicyClauseSchema.loose()).optional(),
  cases: z.looseObject({ rider: AdvocateCaseSchema.optional(), driver: AdvocateCaseSchema.optional() }).optional(),
  result: z.looseObject({ judge: JudgeResultSchema, action: FinalActionSchema }).optional(),
  error: z.looseObject({ code: z.string(), message: z.string() }).optional(),
  missingEvidence: z.array(MissingEvidenceSchema).optional(),
  usage: z
    .looseObject({ modelCalls: z.number().optional(), inputTokens: z.number().optional(), outputTokens: z.number().optional(), latencyMs: z.number().optional() })
    .optional(),
});
export type RunView = z.infer<typeof RunViewSchema>;

export const FixtureListItemSchema = z.looseObject({
  fixtureId: z.string(),
  disputeId: z.string(),
  category: CategorySchema,
  label: z.string(),
  purpose: z.string(),
  riderClaim: z.string(),
  driverStatement: z.string(),
});
export type FixtureListItem = z.infer<typeof FixtureListItemSchema>;
export const FixtureListSchema = z.array(FixtureListItemSchema);

export const CreateRunResponseSchema = z.looseObject({ runId: z.string().min(1) });

export const IsoUtc = IsoUtcSchema;
