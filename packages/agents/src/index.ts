import {
  AdvocateCaseSchema, JudgeResultSchema, EvidenceSchema, PolicyClauseSchema, DisputeSchema,
  validateCitations, type AdvocateCase, type Dispute, type Evidence, type JudgeResult, type PolicyClause
} from '@fairtrip/contracts';

export const WORKFLOW_VERSION = '0.1.0';
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
export interface WorkflowHooks {
  onCase?: (value: AdvocateCase) => void;
  onJudge?: () => void;
}
// Foundation only: production prompts/tool loops remain a later Lane A workstream.
export async function runWorkflow(dispute: Dispute, roles: WorkflowRoles, evidence: Evidence[], policies: PolicyClause[], signal: AbortSignal, hooks: WorkflowHooks = {}) {
  const input = DisputeSchema.parse(dispute);
  const sources = evidence.map(value => EvidenceSchema.parse(value));
  const clauses = policies.map(value => PolicyClauseSchema.parse(value));
  signal.throwIfAborted();
  const cases = await Promise.all((['rider', 'driver'] as const).map(async side => {
    const parsed = AdvocateCaseSchema.parse(await roles.advocate(side, input, signal));
    signal.throwIfAborted();
    if (parsed.side !== side) throw new Error('Advocate returned the wrong side');
    validateCitations([parsed], undefined, sources, clauses);
    hooks.onCase?.(parsed);
    return parsed;
  }));
  signal.throwIfAborted();
  hooks.onJudge?.();
  const result = JudgeResultSchema.parse(await roles.judge(cases, input, signal));
  signal.throwIfAborted();
  validateCitations(cases, result, sources, clauses);
  return {cases, result};
}
