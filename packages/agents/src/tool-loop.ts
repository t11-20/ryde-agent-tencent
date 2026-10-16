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
  // Sources/categories already requested — a request covering only these is redundant.
  const requestedSources = new Set<Evidence['source']>();
  const requestedCategories = new Set<PolicyClause['category']>();
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

    // Tool request: record the assistant turn, execute tools and feed results back
    if (response.type === 'tool_request') {
      conversation.push({role: 'assistant', content: rawResponse});
      const redundant = response.tools.every(tool =>
        tool.name === 'get_evidence'
          ? tool.input.sources.every(source => requestedSources.has(source))
          : requestedCategories.has(tool.input.category));
      const overBudget = toolRounds >= config.maxRounds;
      // A request that re-asks for already-returned material — or arrives after the
      // round budget — gets a directed repair nudge rather than another round: some
      // providers re-ask when the transcript lacks the assistant turn, and extra
      // retrieval never changes what the model can cite.
      if (redundant || overBudget) {
        if (repairAttempts >= config.maxRepairAttempts)
          throw new Error(`Advocate ${side} exceeded maximum tool rounds (${config.maxRounds}) without producing a final case`);
        repairAttempts++;
        emitter?.emit({
          actor: side,
          type: 'output.repair',
          summary: redundant
            ? `${side} repeated a tool request for material already provided; repair attempt ${repairAttempts}`
            : `${side} requested tools after using all ${config.maxRounds} rounds; repair attempt ${repairAttempts}`,
          evidenceIds: [],
          policyClauseIds: []
        });
        const evidenceIds = retrievedEvidence.map(record => record.id).join(', ') || 'none';
        const policyIds = retrievedPolicies.map(clause => clause.id).join(', ') || 'none';
        conversation.push({
          role: 'user',
          content: `${redundant
            ? 'All requested evidence and policy were already returned above'
            : `You have used all ${config.maxRounds} tool rounds. The material available to you is already above`} (evidence IDs: ${evidenceIds}; policy IDs: ${policyIds}). No further information is available. Respond now with your final_case JSON, citing only those IDs.`
        });
        continue;
      }
      toolRounds++;
      for (const tool of response.tools) {
        signal.throwIfAborted();
        if (tool.name === 'get_evidence') {
          for (const source of tool.input.sources) requestedSources.add(source);
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
          requestedCategories.add(tool.input.category);
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
