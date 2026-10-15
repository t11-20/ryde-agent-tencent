import {
  AdvocateCaseSchema, JudgeModelResponseSchema, EvidenceSchema, PolicyClauseSchema, DisputeSchema,
  RiskAssessmentSchema,
  validateCitations, type AdvocateCase, type Dispute, type Evidence, type JudgeModelResponse, type PolicyClause, type ActivityEvent,
  type Precedent, type PolicyVerdict, type RiskAssessment
} from '@fairtrip/contracts';
import type { CalculationProvider } from './remedy-builder.js';

export const WORKFLOW_VERSION = '0.3.3';
export { EXECUTION_LIMITS } from './limits.js';
export interface CompleteOptions {
  thinking?: 'default' | 'adaptive' | 'off';
  hedgeAfterMs?: number;
  onRecovery?: (event: {kind: 'retry' | 'hedge' | 'hedge_won'; summary: string}) => void;
}
export interface ModelAdapter {
  complete(messages: {role: 'system' | 'user' | 'assistant'; content: string}[], signal: AbortSignal, options?: CompleteOptions): Promise<string>;
}
export interface EvidenceTools {
  getEvidence(input: {sources: Evidence['source'][]}, signal: AbortSignal): Promise<Evidence[]>;
  getPolicy(input: {category: Dispute['category']}, signal: AbortSignal): Promise<PolicyClause[]>;
}
export interface JudgeContext {
  risk?: RiskAssessment;
  precedents: Precedent[];
}

export interface WorkflowRoles {
  advocate(side: AdvocateCase['side'], dispute: Dispute, signal: AbortSignal): Promise<unknown>;
  judge(cases: AdvocateCase[], dispute: Dispute, signal: AbortSignal, context: JudgeContext): Promise<unknown>;
  risk?(dispute: Dispute, signal: AbortSignal): Promise<unknown>;
}

export interface WorkflowEvent {
  actor: ActivityEvent['actor'];
  type: ActivityEvent['type'];
  summary: string;
  evidenceIds?: string[];
  policyClauseIds?: string[];
}

export interface WorkflowEventEmitter {
  emit(event: WorkflowEvent): void;
}

// Integration seam (Lane B): a source of fixtures, evidence tools, policy and calculations.
export interface FixtureListing {
  id: string;
  category: Dispute['category'];
  label: string;
  kind: 'fixture';
  purpose: string;
  riderClaim: string;
  driverStatement: string;
}
export interface DisputeSource {
  readonly notice: string;
  listFixtures(): FixtureListing[];
  getDispute(fixtureId: string): Dispute | undefined;
  createTools(dispute: Dispute): EvidenceTools;
  allEvidence(dispute: Dispute): Evidence[];
  policiesFor(category: Dispute['category']): PolicyClause[];
  calculationProvider(dispute: Dispute): CalculationProvider;
  missingDecisiveEvidence(dispute: Dispute): string[];
  policyVerdict(dispute: Dispute): PolicyVerdict;
  riskAssessment(dispute: Dispute): RiskAssessment;
  caseFeatures(dispute: Dispute): string[];
  precedentSeed(): Precedent[];
  similarPrecedents(dispute: Dispute, store: readonly Precedent[], limit?: number): Precedent[];
}

// Re-export tool-loop, prompts, and remedy builder for consumers
export { extractJsonText, outputValidationReason } from './json-output.js';
export { normaliseJudgeOutput, normaliseAdvocateOutput, type Normalised } from './normalise.js';
export { runAdvocateToolLoop, defaultToolLoopConfig, type ToolLoopResult, type ToolLoopConfig } from './tool-loop.js';
export { riderAdvocatePrompt, driverAdvocatePrompt, judgePrompt, riskAnalystPrompt, JUDGE_CONTEXT_RULES } from './prompts.js';
export { runRiskAnalyst, RiskAnalystModelResponseSchema } from './risk-analyst.js';
export { createMockEvidenceTools, mockEvidenceStore, mockPolicyStore } from './mock-evidence.js';
export { buildFinalAction, createMockCalculationProvider, type CalculationProvider, type CalculationResult, type RemedyValidationError } from './remedy-builder.js';

// Orchestrates validated advocates and Judge with cancellation and immediate events.
export async function runWorkflow(
  dispute: Dispute,
  roles: WorkflowRoles,
  evidence: Evidence[],
  policies: PolicyClause[],
  signal: AbortSignal,
  emitter?: WorkflowEventEmitter,
  options?: {precedents?: Precedent[]}
): Promise<{cases: AdvocateCase[]; modelResponse: JudgeModelResponse; risk?: RiskAssessment}> {
  const input = DisputeSchema.parse(dispute);
  const sources = evidence.map(value => EvidenceSchema.parse(value));
  const clauses = policies.map(value => PolicyClauseSchema.parse(value));
  signal.throwIfAborted();
  const advocatesController = new AbortController();
  const advocateSignal = AbortSignal.any([signal, advocatesController.signal]);
  const advocatePromise = Promise.all((['rider', 'driver'] as const).map(async side => {
    try {
      advocateSignal.throwIfAborted();
      emitter?.emit({actor: side, type: 'model.start', summary: `${side} advocate model invocation started`});
      const parsed = AdvocateCaseSchema.parse(await roles.advocate(side, input, advocateSignal));
      emitter?.emit({actor: side, type: 'model.finish', summary: `${side} advocate model invocation finished`});
      advocateSignal.throwIfAborted();
      if (parsed.side !== side) throw new Error('Advocate returned the wrong side');
      validateCitations([parsed], undefined, sources, clauses);
      emitter?.emit({actor: side, type: 'case.completed', summary: `${side} case validated and completed`, evidenceIds: parsed.arguments.flatMap(a => a.evidenceIds), policyClauseIds: parsed.arguments.flatMap(a => a.policyClauseIds)});
      return parsed;
    } catch (error) {
      advocatesController.abort(error);
      throw error;
    }
  }));
  const riskRole = roles.risk;
  const riskPromise = riskRole === undefined ? Promise.resolve(undefined) : (async (): Promise<RiskAssessment | undefined> => {
    try {
      emitter?.emit({actor: 'risk', type: 'model.start', summary: 'Risk analyst model invocation started'});
      const assessment = RiskAssessmentSchema.parse(await riskRole(input, signal));
      emitter?.emit({actor: 'risk', type: 'model.finish', summary: 'Risk analyst model invocation finished'});
      emitter?.emit({
        actor: 'risk', type: 'risk.assessed',
        summary: `Risk ${assessment.overall}: ${assessment.summary}`,
        evidenceIds: [...new Set(assessment.signals.flatMap(s => s.evidenceIds))],
      });
      return assessment;
    } catch (error) {
      if (signal.aborted) throw error;
      emitter?.emit({actor: 'risk', type: 'risk.assessed', summary: 'Risk assessment unavailable; the Judge rules on trip evidence alone.'});
      return undefined;
    }
  })();
  const [cases, risk] = await Promise.all([advocatePromise, riskPromise]);
  signal.throwIfAborted();
  const precedents = options?.precedents ?? [];
  emitter?.emit({
    actor: 'precedent', type: 'precedent.retrieved',
    summary: precedents.length > 0
      ? `${precedents.length} similar past ruling(s) retrieved for consistency: ${precedents.map(p => p.id).join(', ')}`
      : 'No similar past ruling found; the Judge rules on this case alone.',
  });
  emitter?.emit({actor: 'judge', type: 'judge.started', summary: 'Both cases validated; Judge handoff'});
  emitter?.emit({actor: 'judge', type: 'model.start', summary: 'Judge model invocation started'});
  const context: JudgeContext = {precedents, ...(risk !== undefined ? {risk} : {})};
  const modelResponse = JudgeModelResponseSchema.parse(await roles.judge(cases, input, signal, context));
  emitter?.emit({actor: 'judge', type: 'model.finish', summary: 'Judge model invocation finished'});
  signal.throwIfAborted();
  validateCitations(cases, modelResponse, sources, clauses);
  return {cases, modelResponse, ...(risk !== undefined ? {risk} : {})};
}
