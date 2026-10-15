import {
  AdvocateResponseSchema, AdvocateCaseSchema, type AdvocateCase, type Dispute, type Evidence, type PolicyClause, type AdvocateResponse
} from '@fairtrip/contracts';
import type { ModelAdapter, EvidenceTools, WorkflowEventEmitter } from './index.js';
import { extractJsonText, outputValidationReason } from './json-output.js';
import { normaliseAdvocateOutput } from './normalise.js';
import { EXECUTION_LIMITS } from './limits.js';

export interface ToolLoopResult {
  case: AdvocateCase;
  retrievedEvidence: Evidence[];
  retrievedPolicies: PolicyClause[];
}

export interface ToolLoopConfig {
  maxRounds: number;
  maxRepairAttempts: number;
  modelTimeoutMs: number;
  // Thinking depth for post-tool calls; the first (tool-request) call always runs 'off'.
  thinking?: 'default' | 'adaptive' | 'off';
  // Optional directed-repair hook run on every final_case: throws when the case
  // cites identifiers no tool returned. The thrown message names the bad IDs and
  // is echoed back to the model in the repair request.
  validateFinalCase?: (finalCase: AdvocateCase, retrievedEvidence: Evidence[], retrievedPolicies: PolicyClause[]) => void;
}

export function defaultToolLoopConfig(): ToolLoopConfig {
  return {maxRounds: EXECUTION_LIMITS.toolRounds, maxRepairAttempts: EXECUTION_LIMITS.repairAttempts, modelTimeoutMs: EXECUTION_LIMITS.modelTimeoutMs, thinking: 'default'};
}

export async function runAdvocateToolLoop(
  side: AdvocateCase['side'],
  dispute: Dispute,
  modelAdapter: ModelAdapter,
  evidenceTools: EvidenceTools,
  emitter: WorkflowEventEmitter | undefined,
  signal: AbortSignal,
  systemPrompt: string,
  config: ToolLoopConfig = defaultToolLoopConfig()
): Promise<ToolLoopResult> {
  const retrievedEvidence: Evidence[] = [];
  const retrievedPolicies: PolicyClause[] = [];
  const conversation: {role: 'system' | 'user' | 'assistant'; content: string}[] = [
    {role: 'system', content: systemPrompt}
  ];

  let repairAttempts = 0;
  let toolRounds = 0;

  while (true) {
    signal.throwIfAborted();

    // Call the model. Before any tool result has been fed back the call is a
    // cheap tool-request turn (thinking off, tight hedge); later calls produce
    // the case and get the configured thinking depth and a wider hedge window.
    const modelSignal = AbortSignal.any([signal, AbortSignal.timeout(config.modelTimeoutMs)]);
    const firstCall = toolRounds === 0;
    const rawResponse = await modelAdapter.complete(conversation, modelSignal, {
      thinking: firstCall ? 'off' : config.thinking ?? 'default',
      hedgeAfterMs: firstCall ? EXECUTION_LIMITS.hedgeAfterMs.toolRequest : EXECUTION_LIMITS.hedgeAfterMs.advocateCase,
      onRecovery: event => emitter?.emit({
        actor: side,
        type: event.kind === 'retry' ? 'model.retry' : 'model.hedge',
        summary: event.summary,
        evidenceIds: [],
        policyClauseIds: []
      })
    });

    // Try to parse as AdvocateResponse
    let response: AdvocateResponse;
    try {
      const parsed = JSON.parse(extractJsonText(rawResponse));
      const normalised = normaliseAdvocateOutput(parsed);
      if (normalised.notes.length > 0) {
        emitter?.emit({
          actor: side,
          type: 'output.normalised',
          summary: `${side} output normalised without a repair: ${normalised.notes.join('; ')}`,
          evidenceIds: [],
          policyClauseIds: []
        });
      }
      response = AdvocateResponseSchema.parse(normalised.value);
    } catch (parseError) {
      const reason = outputValidationReason(parseError);
      // Attempt repair if within limit
      if (repairAttempts < config.maxRepairAttempts) {
        repairAttempts++;
        emitter?.emit({
          actor: side,
          type: 'output.repair',
          summary: `Malformed advocate response (${reason}); repair attempt ${repairAttempts}`,
          evidenceIds: [],
          policyClauseIds: []
        });
        conversation.push({role: 'assistant', content: rawResponse});
        conversation.push({
          role: 'user',
          content: `Your previous response failed validation (${reason}). Please respond with a valid JSON object following the format specified in your instructions.`
        });
        continue;
      }
      throw new Error(`Advocate ${side} produced unparseable output after ${repairAttempts} repair attempts (${reason})`);
    }

    if (response.type === 'final_case') {
      // Validate the case side matches
      if (response.case.side !== side) {
        throw new Error(`Advocate returned wrong side: expected ${side}, got ${response.case.side}`);
      }
      try {
        config.validateFinalCase?.(response.case, retrievedEvidence, retrievedPolicies);
      } catch (validationError) {
        // Parse repairs and citation repairs share the single repairAttempts budget.
        if (repairAttempts < config.maxRepairAttempts) {
          repairAttempts++;
          emitter?.emit({
            actor: side,
            type: 'output.repair',
            summary: `Advocate case failed citation validation; repair attempt ${repairAttempts}`,
            evidenceIds: [],
            policyClauseIds: []
          });
          conversation.push({role: 'assistant', content: rawResponse});
          conversation.push({
            role: 'user',
            content: `Your case cited identifiers that no tool returned: ${validationError instanceof Error ? validationError.message : String(validationError)}. Remove or replace them, citing only evidence and policy IDs from the tool results, and return the final_case JSON again.`
          });
          continue;
        }
        throw validationError;
      }
      return {case: response.case, retrievedEvidence, retrievedPolicies};
    }

    // Tool request: execute tools and feed results back
    if (response.type === 'tool_request') {
      if (toolRounds >= config.maxRounds) throw new Error(`Advocate ${side} exceeded maximum tool rounds (${config.maxRounds}) without producing a final case`);
      toolRounds++;
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

}
