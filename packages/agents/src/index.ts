import {
  AdvocateCaseSchema, JudgeModelResponseSchema, EvidenceSchema, PolicyClauseSchema, DisputeSchema,
  validateCitations, type AdvocateCase, type Dispute, type Evidence, type JudgeModelResponse, type PolicyClause, type ActivityEvent
} from '@fairtrip/contracts';
import type { CalculationProvider } from './remedy-builder.js';

export const WORKFLOW_VERSION = '0.2.0';
export const EXECUTION_LIMITS = Object.freeze({toolRounds: 2, repairAttempts: 1, modelTimeoutMs: 20000, runDeadlineMs: 90000});
export interface ModelAdapter {
  complete(messages: {role: 'system' | 'user' | 'assistant'; content: string}[], signal: AbortSignal): Promise<string>;
}
export interface EvidenceTools {
  getEvidence(input: {sources: Evidence['source'][]}, signal: AbortSignal): Promise<Evidence[]>;
  getPolicy(input: {category: Dispute['category']}, signal: AbortSignal): Promise<PolicyClause[]>;
}
export interface WorkflowRoles {
  advocate(side: AdvocateCase['side'], dispute: Dispute, signal: AbortSignal): Promise<unknown>;
  judge(cases: AdvocateCase[], dispute: Dispute, signal: AbortSignal): Promise<unknown>;
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
}

// Re-export tool-loop, prompts, and remedy builder for consumers
export { runAdvocateToolLoop, type ToolLoopResult, type ToolLoopConfig } from './tool-loop.js';
export { riderAdvocatePrompt, driverAdvocatePrompt, judgePrompt } from './prompts.js';
export { createMockEvidenceTools, mockEvidenceStore, mockPolicyStore } from './mock-evidence.js';
export { buildFinalAction, createMockCalculationProvider, type CalculationProvider, type CalculationResult, type RemedyValidationError } from './remedy-builder.js';

// Orchestrates validated advocates and Judge with cancellation and immediate events.
export async function runWorkflow(
  dispute: Dispute,
  roles: WorkflowRoles,
  evidence: Evidence[],
  policies: PolicyClause[],
  signal: AbortSignal,
  emitter?: WorkflowEventEmitter
) {
  const input = DisputeSchema.parse(dispute);
  const sources = evidence.map(value => EvidenceSchema.parse(value));
  const clauses = policies.map(value => PolicyClauseSchema.parse(value));
  signal.throwIfAborted();
  const advocatesController = new AbortController();
  const advocateSignal = AbortSignal.any([signal, advocatesController.signal]);
  const cases = await Promise.all((['rider', 'driver'] as const).map(async side => {
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
  signal.throwIfAborted();
  emitter?.emit({actor: 'judge', type: 'judge.started', summary: 'Both cases validated; Judge handoff'});
  emitter?.emit({actor: 'judge', type: 'model.start', summary: 'Judge model invocation started'});
  const modelResponse = JudgeModelResponseSchema.parse(await roles.judge(cases, input, signal));
  emitter?.emit({actor: 'judge', type: 'model.finish', summary: 'Judge model invocation finished'});
  signal.throwIfAborted();
  validateCitations(cases, modelResponse, sources, clauses);
  return {cases, modelResponse};
}
