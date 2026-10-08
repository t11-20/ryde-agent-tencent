import {
  AdvocateResponseSchema, AdvocateCaseSchema, type AdvocateCase, type Dispute, type Evidence, type PolicyClause, type AdvocateResponse
} from '@fairtrip/contracts';
import type { ModelAdapter, EvidenceTools, WorkflowEventEmitter } from './index.js';

export interface ToolLoopResult {
  case: AdvocateCase;
  retrievedEvidence: Evidence[];
  retrievedPolicies: PolicyClause[];
}

export interface ToolLoopConfig {
  maxRounds: number;
  maxRepairAttempts: number;
  modelTimeoutMs: number;
}

export async function runAdvocateToolLoop(
  side: AdvocateCase['side'],
  dispute: Dispute,
  modelAdapter: ModelAdapter,
  evidenceTools: EvidenceTools,
  emitter: WorkflowEventEmitter | undefined,
  signal: AbortSignal,
  systemPrompt: string,
  config: ToolLoopConfig = {maxRounds: 2, maxRepairAttempts: 1, modelTimeoutMs: 20000}
): Promise<ToolLoopResult> {
  const retrievedEvidence: Evidence[] = [];
  const retrievedPolicies: PolicyClause[] = [];
  const conversation: {role: 'system' | 'user' | 'assistant'; content: string}[] = [
    {role: 'system', content: systemPrompt}
  ];

  let repairAttempts = 0;

  for (let round = 0; round < config.maxRounds; round++) {
    signal.throwIfAborted();

    // Call the model
    const modelSignal = AbortSignal.any([signal, AbortSignal.timeout(config.modelTimeoutMs)]);
    const rawResponse = await modelAdapter.complete(conversation, modelSignal);

    // Try to parse as AdvocateResponse
    let response: AdvocateResponse;
    try {
      const parsed = JSON.parse(rawResponse);
      response = AdvocateResponseSchema.parse(parsed);
    } catch (parseError) {
      // Attempt repair if within limit
      if (repairAttempts < config.maxRepairAttempts) {
        repairAttempts++;
        emitter?.emit({
          actor: side,
          type: 'output.repair',
          summary: `Malformed advocate response; repair attempt ${repairAttempts}`,
          evidenceIds: [],
          policyClauseIds: []
        });
        conversation.push({role: 'assistant', content: rawResponse});
        conversation.push({
          role: 'user',
          content: 'Your previous response was not valid JSON or did not match the required schema. Please respond with a valid JSON object following the format specified in your instructions.'
        });
        continue;
      }
      throw new Error(`Advocate ${side} produced unparseable output after ${repairAttempts} repair attempts: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    if (response.type === 'final_case') {
      // Validate the case side matches
      if (response.case.side !== side) {
        throw new Error(`Advocate returned wrong side: expected ${side}, got ${response.case.side}`);
      }
      return {case: response.case, retrievedEvidence, retrievedPolicies};
    }

    // Tool request: execute tools and feed results back
    if (response.type === 'tool_request') {
      for (const tool of response.tools) {
        signal.throwIfAborted();
        if (tool.name === 'get_evidence') {
          emitter?.emit({
            actor: side,
            type: 'tool.requested',
            summary: `${side} requested evidence: ${tool.input.sources.join(', ')}`,
            evidenceIds: [],
            policyClauseIds: []
          });
          const evidence = await evidenceTools.getEvidence(tool.input, signal);
          for (const e of evidence) {
            if (!retrievedEvidence.some(re => re.id === e.id)) {
              retrievedEvidence.push(e);
            }
          }
          emitter?.emit({
            actor: side,
            type: 'evidence.retrieved',
            summary: `${side} retrieved ${evidence.length} evidence records`,
            evidenceIds: evidence.map(e => e.id),
            policyClauseIds: []
          });
          conversation.push({
            role: 'user',
            content: `Evidence retrieval results:\n${JSON.stringify(evidence, null, 2)}`
          });
        } else if (tool.name === 'get_policy') {
          emitter?.emit({
            actor: side,
            type: 'tool.requested',
            summary: `${side} requested policy for ${tool.input.category}`,
            evidenceIds: [],
            policyClauseIds: []
          });
          const policies = await evidenceTools.getPolicy(tool.input, signal);
          for (const p of policies) {
            if (!retrievedPolicies.some(rp => rp.id === p.id)) {
              retrievedPolicies.push(p);
            }
          }
          emitter?.emit({
            actor: side,
            type: 'policy.retrieved',
            summary: `${side} retrieved ${policies.length} policy clauses`,
            evidenceIds: [],
            policyClauseIds: policies.map(p => p.id)
          });
          conversation.push({
            role: 'user',
            content: `Policy retrieval results:\n${JSON.stringify(policies, null, 2)}`
          });
        }
      }
    }
  }

  throw new Error(`Advocate ${side} exceeded maximum tool rounds (${config.maxRounds}) without producing a final case`);
}
