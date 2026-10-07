// PROVISIONAL mirror of Lane A contracts. Replace with Lane A's package at integration.
// Loose (passthrough) objects: the eval only needs the fields it checks, and must not
// reject responses for carrying extra fields.
import { z } from "zod";

const CitedPoint = z.looseObject({ point: z.string(), evidenceIds: z.array(z.string()), policyIds: z.array(z.string()) });

export const RunViewSchema = z.looseObject({
  runId: z.string(),
  status: z.enum(["queued", "running", "completed", "incomplete", "failed"]),
  events: z.array(
    z.looseObject({
      runId: z.string(),
      sequence: z.number().int(),
      timestamp: z.string(),
      actor: z.string(),
      type: z.string(),
      summary: z.string(),
      refs: z.looseObject({ evidenceIds: z.array(z.string()).optional(), policyIds: z.array(z.string()).optional() }).optional(),
      data: z.unknown().optional(),
    }),
  ),
  evidence: z.array(z.looseObject({ id: z.string(), family: z.string() })).optional(),
  cases: z
    .looseObject({
      rider: z.looseObject({ arguments: z.array(CitedPoint), counterevidence: z.array(CitedPoint) }).optional(),
      driver: z.looseObject({ arguments: z.array(CitedPoint), counterevidence: z.array(CitedPoint) }).optional(),
    })
    .optional(),
  result: z
    .looseObject({
      judge: z.looseObject({ findings: z.array(CitedPoint), remedyId: z.string().nullable() }),
      action: z.looseObject({ remedyId: z.string(), amountCents: z.number().nullable(), recipient: z.string().nullable().optional() }).optional(),
    })
    .optional(),
  error: z.looseObject({ code: z.string(), message: z.string() }).optional(),
  missingEvidence: z.array(z.looseObject({ family: z.string(), reason: z.string() })).optional(),
  usage: z
    .looseObject({ modelCalls: z.number().optional(), inputTokens: z.number().optional(), outputTokens: z.number().optional(), latencyMs: z.number().optional() })
    .optional(),
});
export type RunView = z.infer<typeof RunViewSchema>;
export type RunEvent = RunView["events"][number];

export const CreateRunResponseSchema = z.looseObject({ runId: z.string().min(1) });

export const TERMINAL = ["completed", "incomplete", "failed"] as const;
export const isTerminal = (s: string): boolean => (TERMINAL as readonly string[]).includes(s);
