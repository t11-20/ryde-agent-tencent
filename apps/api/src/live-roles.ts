import { JudgeModelResponseSchema, validateCitations, type AdvocateCase, type Dispute, type Evidence, type PolicyClause, type RiskAssessment } from '@fairtrip/contracts';
import {
  createMockEvidenceTools, extractJsonText, outputValidationReason, normaliseJudgeOutput,
  runAdvocateToolLoop, defaultToolLoopConfig,
  riderAdvocatePrompt, driverAdvocatePrompt, judgePrompt,
  runRiskAnalyst,
  EXECUTION_LIMITS, type EvidenceTools, type JudgeContext, type ModelAdapter, type WorkflowEventEmitter, type WorkflowRoles
} from '@fairtrip/agents';

// Ported from CodeBuddy's saved live wiring. Lane A remains independent of Lane B.
// The model is live; evidence and calculations remain labeled contract examples.
export function createLiveRoles(
  model: ModelAdapter,
  emitter: WorkflowEventEmitter,
  retrievedEvidence: Evidence[],
  retrievedPolicies: PolicyClause[],
  cases: AdvocateCase[],
  toolsFor?: (dispute: Dispute) => EvidenceTools,
  riskFor?: (dispute: Dispute) => {assessment: RiskAssessment; records: Evidence[]},
  modelOptions: {thinking: 'default' | 'adaptive' | 'off'} = {thinking: 'default'}
): WorkflowRoles {
  const dataLabel = toolsFor ? 'SYNTHETIC FIXTURE' : 'SYNTHETIC CONTRACT EXAMPLE';
  const roles: WorkflowRoles = {
    async advocate(side, dispute, signal) {
      const tools = toolsFor ? toolsFor(dispute) : createMockEvidenceTools(dispute);
      let evidenceRequested = false;
      let policyRequested = false;
      const prompt = side === 'rider' ? riderAdvocatePrompt(dispute) : driverAdvocatePrompt(dispute);
      const output = await runAdvocateToolLoop(side, dispute, model, {
        async getEvidence(input, toolSignal) {
          evidenceRequested = true;
          return tools.getEvidence(input, toolSignal);
        },
        async getPolicy(input, toolSignal) {
          policyRequested = true;
          return tools.getPolicy(input, toolSignal);
        }
      }, emitter, signal, `${prompt}\n\nEvidence is ${dataLabel} data; policies are DEMONSTRATION POLICY. Both tools must be requested independently by each advocate.`,
      // Citation validation runs inside the loop so an invented ID gets a directed
      // repair instead of hard-failing the run; the post-loop call below is a
      // belt-and-braces check that should never throw.
      {...defaultToolLoopConfig(), thinking: modelOptions.thinking, validateFinalCase: (finalCase, evidence, policies) => validateCitations([finalCase], undefined, evidence, policies)});
      signal.throwIfAborted();
      if (!evidenceRequested || !policyRequested) throw new Error('Each live advocate must independently request evidence and policy.');
      validateCitations([output.case], undefined, output.retrievedEvidence, output.retrievedPolicies);
      for (const record of output.retrievedEvidence) {
        if (!retrievedEvidence.some(existing => existing.id === record.id)) retrievedEvidence.push(record);
      }
      for (const clause of output.retrievedPolicies) {
        if (!retrievedPolicies.some(existing => existing.id === clause.id)) retrievedPolicies.push(clause);
      }
      cases.push(output.case);
      return output.case;
    },
    async judge(advocateCases, dispute, signal, context: JudgeContext) {
      const messages: Parameters<ModelAdapter['complete']>[0] = [
        {role: 'system', content: `${judgePrompt(dispute)}\n\nThis run uses ${dataLabel} evidence and DEMONSTRATION POLICY; it is not a real dispute decision.`},
        {role: 'user', content: JSON.stringify({dispute, cases: advocateCases, evidence: retrievedEvidence, policies: retrievedPolicies, precedents: context.precedents, ...(context.risk !== undefined ? {risk: context.risk} : {})})}
      ];
      for (let attempt = 0; attempt <= EXECUTION_LIMITS.repairAttempts; attempt++) {
        signal.throwIfAborted();
        const raw = await model.complete(messages, AbortSignal.any([signal, AbortSignal.timeout(EXECUTION_LIMITS.modelTimeoutMs)]), {
          thinking: modelOptions.thinking,
          hedgeAfterMs: EXECUTION_LIMITS.hedgeAfterMs.judge,
          onRecovery: event => emitter.emit({
            actor: 'judge',
            type: event.kind === 'retry' ? 'model.retry' : 'model.hedge',
            summary: event.summary,
            evidenceIds: [],
            policyClauseIds: []
          })
        });
        signal.throwIfAborted();
        try {
          const normalised = normaliseJudgeOutput(JSON.parse(extractJsonText(raw)));
          if (normalised.notes.length > 0) {
            emitter.emit({actor: 'judge', type: 'output.normalised', summary: `Judge output normalised without a repair: ${normalised.notes.join('; ')}`, evidenceIds: [], policyClauseIds: []});
          }
          const response = JudgeModelResponseSchema.parse(normalised.value);
          validateCitations([], response, retrievedEvidence, retrievedPolicies);
          return response;
        } catch (validationError) {
          const reason = outputValidationReason(validationError);
          if (attempt === EXECUTION_LIMITS.repairAttempts) throw new Error(`Judge output failed schema or citation validation after ${EXECUTION_LIMITS.repairAttempts} repair attempts (${reason}).`);
          emitter.emit({actor: 'judge', type: 'output.repair', summary: `Judge output failed validation (${reason}); directed repair ${attempt + 1} requested.`});
          messages.push({role: 'assistant', content: raw}, {role: 'user', content: `Your previous output failed validation (${reason}). Return only valid JSON matching the Judge schema. Use only evidence and policy IDs in the provided context. Do not include an action, amount, or recipient.`});
        }
      }
      throw new Error('Judge output validation failed.');
    }
  };
  if (riskFor !== undefined) {
    const riskSource = riskFor;
    roles.risk = async (dispute, signal) => {
      const {assessment, records} = riskSource(dispute);
      return runRiskAnalyst(
        dispute, assessment, records, model, signal,
        `\n\nEvidence is ${dataLabel} data; policies are DEMONSTRATION POLICY.`,
      );
    };
  }
  return roles;
}
