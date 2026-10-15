import { z } from 'zod';

export const CONTRACT_VERSION = '0.3.3';
const Id = z.string().trim().min(1);
const Timestamp = z.iso.datetime();
export const CategorySchema = z.enum(['route_deviation', 'no_show']);
export const SourceSchema = z.enum(['gps', 'chat', 'payment', 'history']);
export const ModeSchema = z.enum(['stub', 'live', 'replay']);
export const RemedySchema = z.enum(['keep_charge', 'refund_route_excess', 'refund_no_show_fee']);
export const DisputeSchema = z.strictObject({
  id: Id, category: CategorySchema, tripId: Id, riderClaim: z.string().min(1), driverStatement: z.string()
});
// The shared envelope does not define partner-owned source-specific payload schemas.
export const EvidenceSchema = z.strictObject({
  id: Id, source: SourceSchema, timestamp: Timestamp, facts: z.record(z.string(), z.json()),
  provenance: z.strictObject({kind: z.enum(['contract_example', 'fixture']), description: z.string().min(1)})
});
export const PolicyClauseSchema = z.strictObject({
  id: Id, version: Id, category: CategorySchema, ruleText: z.string().min(1), remedyCriteria: z.string().min(1)
});
const ArgumentSchema = z.strictObject({
  claim: z.string().min(1), evidenceIds: z.array(Id), policyClauseIds: z.array(Id)
});
export const AdvocateCaseSchema = z.strictObject({
  side: z.enum(['rider', 'driver']), summary: z.string().min(1), arguments: z.array(ArgumentSchema),
  counterevidence: z.array(ArgumentSchema), requestedRemedyId: RemedySchema.optional(), missingFacts: z.array(z.string().min(1))
});
export const FinalActionSchema = z.strictObject({
  remedyId: RemedySchema, recipient: z.enum(['rider', 'driver', 'none']), currency: z.literal('SGD'),
  amountCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), recommendation: z.string().min(1)
}).superRefine((action, ctx) => {
  if (action.remedyId === 'keep_charge' && (action.amountCents !== 0 || action.recipient !== 'none'))
    ctx.addIssue({code: 'custom', message: 'keep_charge requires zero cents and no recipient'});
});

// Model-facing: what the Judge agent returns (NO money/recipient)
export const JudgeModelResponseSchema = z.strictObject({
  ruling: z.enum(['rider_favored', 'driver_favored', 'incomplete']),
  findings: z.array(ArgumentSchema),
  remedyId: RemedySchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  riderExplanation: z.string().min(1),
  driverExplanation: z.string().min(1)
});

// Server-constructed: validated model response + server-built action
export const JudgeResultSchema = z.strictObject({
  ...JudgeModelResponseSchema.shape,
  action: FinalActionSchema
}).refine(result => result.remedyId === result.action.remedyId,
  {message: 'Result and action remedies must match'});

export const ActivityEventSchema = z.strictObject({
  runId: Id, sequence: z.number().int().positive(), timestamp: Timestamp, mode: ModeSchema,
  actor: z.enum(['system', 'rider', 'driver', 'judge', 'risk', 'precedent']),
  type: z.enum([
    'run.started', 'model.start', 'model.finish', 'tool.requested', 'evidence.retrieved',
    'policy.retrieved', 'case.completed', 'output.repair', 'judge.started', 'run.completed',
    'run.incomplete', 'run.failed', 'risk.assessed', 'precedent.retrieved', 'run.escalated',
    'review.decided', 'verdict.computed', 'run.retrying', 'model.retry', 'model.hedge',
    'output.normalised'
  ]),
  summary: z.string().min(1), evidenceIds: z.array(Id), policyClauseIds: z.array(Id)
});

export const RISK_CAVEAT = 'Context only: risk signals never establish fault and never override trip evidence.';
export const RiskSeveritySchema = z.enum(['low', 'medium', 'high']);
export const RiskSignalSchema = z.strictObject({
  code: Id, party: z.enum(['rider', 'driver']), severity: RiskSeveritySchema, detail: z.string().min(1), evidenceIds: z.array(Id).min(1)
});
export const RiskAssessmentSchema = z.strictObject({
  overall: RiskSeveritySchema, signals: z.array(RiskSignalSchema), summary: z.string().min(1),
  caveat: z.literal(RISK_CAVEAT), source: z.enum(['model', 'deterministic'])
});
export const PrecedentSchema = z.strictObject({
  id: Id, category: CategorySchema, decidedAt: Timestamp, origin: z.enum(['seed', 'run', 'human_override']),
  ruling: z.enum(['rider_favored', 'driver_favored']), remedyId: RemedySchema,
  features: z.array(z.string().min(1)).min(1), summary: z.string().min(1), runId: Id.optional()
});
export const EscalationSchema = z.strictObject({
  reasons: z.array(z.enum(['low_confidence', 'high_risk', 'policy_divergence', 'policy_undetermined'])).min(1),
  confidence: z.number().min(0).max(1), threshold: z.number().min(0).max(1), summary: z.string().min(1)
});
// Deterministic outcome of the demonstration policy on the case features — no model involved.
const VerdictOutcomeSchema = z.enum(['keep_charge', 'refund_route_excess', 'refund_no_show_fee', 'incomplete', 'undetermined']);
export const PolicyVerdictSchema = z.strictObject({
  outcome: VerdictOutcomeSchema, clauseIds: z.array(Id), basis: z.string().min(1),
  features: z.array(z.string()), missingFamilies: z.array(z.string())
});
export const RunDivergenceSchema = z.strictObject({
  judgeRemedyId: RemedySchema, verdictOutcome: VerdictOutcomeSchema, summary: z.string().min(1)
});
export const ReviewSchema = z.strictObject({
  decision: z.enum(['confirmed', 'overridden']), decidedAt: Timestamp, note: z.string(),
  ruling: z.enum(['rider_favored', 'driver_favored']), action: FinalActionSchema
});
export const ReplaySchema = z.strictObject({
  sourceRunId: Id, recordedAt: Timestamp, sourceEvalRun: z.string().min(1), speed: z.number().positive()
});
export const ReviewRequestSchema = z.strictObject({
  decision: z.enum(['confirmed', 'overridden']), remedyId: RemedySchema.optional(), note: z.string().trim().max(2000).default('')
}).superRefine((review, ctx) => {
  if (review.decision === 'overridden' && review.remedyId === undefined)
    ctx.addIssue({code: 'custom', message: 'An override must name the remedy to apply'});
});

const RunFields = {
  id: Id, fixtureId: Id, mode: ModeSchema, dispute: DisputeSchema,
  cases: z.array(AdvocateCaseSchema), events: z.array(ActivityEventSchema),
  retrievedEvidence: z.array(EvidenceSchema),
  retrievedPolicies: z.array(PolicyClauseSchema),
  risk: RiskAssessmentSchema.optional(), precedents: z.array(PrecedentSchema).optional(),
  replay: ReplaySchema.optional(), verdict: PolicyVerdictSchema.optional(),
  retryOf: Id.optional(), retriedBy: Id.optional()
};

export const RunSchema = z.discriminatedUnion('status', [
  z.strictObject({...RunFields, status: z.enum(['queued', 'running'])}),
  z.strictObject({...RunFields, status: z.literal('completed'), result: JudgeResultSchema,
    escalation: EscalationSchema.optional(), review: ReviewSchema.optional(),
    divergence: RunDivergenceSchema.optional()}),
  z.strictObject({...RunFields, status: z.literal('failed'), error: z.strictObject({code: Id, message: z.string().min(1)})}),
  z.strictObject({...RunFields, status: z.literal('incomplete'), missingEvidence: z.array(z.string().min(1)).min(1)})
]).superRefine((run, ctx) => {
  let previous = 0;
  for (const event of run.events) {
    if (event.runId !== run.id || event.mode !== run.mode || event.sequence <= previous)
      ctx.addIssue({code: 'custom', message: 'Events must match the run and have increasing sequences'});
    previous = event.sequence;
  }
  const sides = run.cases.map(c => c.side);
  if (new Set(sides).size !== sides.length)
    ctx.addIssue({code: 'custom', message: 'Duplicate advocate side'});
  if (run.status === 'completed' && (!sides.includes('rider') || !sides.includes('driver')))
    ctx.addIssue({code: 'custom', message: 'Completed runs require both advocate cases'});
  if (run.status === 'completed' && run.review !== undefined) {
    if (run.review.decision === 'confirmed' && run.review.action.remedyId !== run.result.action.remedyId)
      ctx.addIssue({code: 'custom', message: 'A confirmed review must keep the Judge remedy'});
    if (run.escalation === undefined)
      ctx.addIssue({code: 'custom', message: 'A review requires an escalated run'});
  }
});

export const StartRunSchema = z.strictObject({fixtureId: Id, riderClaim: z.string().trim().min(1).max(10000).optional()});
export const FixtureSummarySchema = z.strictObject({
  id: Id, category: CategorySchema, label: z.string().min(1), kind: z.literal('contract_example')
});

// Advocate tool-response protocol: either requests tools or produces a final case
export const AdvocateResponseSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('tool_request'),
    tools: z.array(z.discriminatedUnion('name', [
      z.strictObject({name: z.literal('get_evidence'), input: z.strictObject({sources: z.array(SourceSchema).min(1)})}),
      z.strictObject({name: z.literal('get_policy'), input: z.strictObject({category: CategorySchema})})
    ])).min(1)
  }),
  z.strictObject({
    type: z.literal('final_case'),
    case: AdvocateCaseSchema
  })
]);

export type Dispute = z.infer<typeof DisputeSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type PolicyClause = z.infer<typeof PolicyClauseSchema>;
export type AdvocateCase = z.infer<typeof AdvocateCaseSchema>;
export type JudgeModelResponse = z.infer<typeof JudgeModelResponseSchema>;
export type JudgeResult = z.infer<typeof JudgeResultSchema>;
export type FinalAction = z.infer<typeof FinalActionSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type Run = z.infer<typeof RunSchema>;
export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;
export type RiskSignal = z.infer<typeof RiskSignalSchema>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export type Precedent = z.infer<typeof PrecedentSchema>;
export type Escalation = z.infer<typeof EscalationSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
export type AdvocateResponse = z.infer<typeof AdvocateResponseSchema>;
export type Replay = z.infer<typeof ReplaySchema>;
export type PolicyVerdict = z.infer<typeof PolicyVerdictSchema>;
export type VerdictOutcome = z.infer<typeof VerdictOutcomeSchema>;
export type RunDivergence = z.infer<typeof RunDivergenceSchema>;

export function validateCitations(cases: AdvocateCase[], result: JudgeModelResponse | undefined, evidence: Evidence[], policies: PolicyClause[]): void {
  const evidenceIds = new Set(evidence.map(e => e.id));
  const policyIds = new Set(policies.map(p => p.id));
  if (evidenceIds.size !== evidence.length || policyIds.size !== policies.length) throw new Error('Duplicate source identifier');
  const argumentsToCheck = [...cases.flatMap(c => [...c.arguments, ...c.counterevidence]), ...(result?.findings ?? [])];
  for (const argument of argumentsToCheck) {
    for (const id of argument.evidenceIds) if (!evidenceIds.has(id)) throw new Error(`Unknown evidence citation: ${id}`);
    for (const id of argument.policyClauseIds) if (!policyIds.has(id)) throw new Error(`Unknown policy citation: ${id}`);
  }
}
