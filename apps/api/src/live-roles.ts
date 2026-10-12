import { JudgeModelResponseSchema, validateCitations, type AdvocateCase, type Dispute, type Evidence, type PolicyClause } from '@fairtrip/contracts';
import {
  createMockEvidenceTools, runAdvocateToolLoop, riderAdvocatePrompt, driverAdvocatePrompt, judgePrompt,
  EXECUTION_LIMITS, type EvidenceTools, type ModelAdapter, type WorkflowEventEmitter, type WorkflowRoles
} from '@fairtrip/agents';

// Ported from CodeBuddy's saved live wiring. Lane A remains independent of Lane B.
// The model is live; evidence and calculations remain labeled contract examples.
export function createLiveRoles(
  model: ModelAdapter,
  emitter: WorkflowEventEmitter,
  retrievedEvidence: Evidence[],
  retrievedPolicies: PolicyClause[],
  cases: AdvocateCase[],
  toolsFor?: (dispute: Dispute) => EvidenceTools
): WorkflowRoles {
  const dataLabel = toolsFor ? 'SYNTHETIC FIXTURE' : 'SYNTHETIC CONTRACT EXAMPLE';
  return {
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
      }, emitter, signal, `${prompt}\n\nEvidence is ${dataLabel} data; policies are DEMONSTRATION POLICY. Both tools must be requested independently by each advocate.`);
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
    async judge(advocateCases, dispute, signal) {
      const messages: Parameters<ModelAdapter['complete']>[0] = [
        {role: 'system', content: `${judgePrompt(dispute)}\n\nThis run uses ${dataLabel} evidence and DEMONSTRATION POLICY; it is not a real dispute decision.`},
        {role: 'user', content: JSON.stringify({dispute, cases: advocateCases, evidence: retrievedEvidence, policies: retrievedPolicies})}
      ];
      for (let attempt = 0; attempt <= EXECUTION_LIMITS.repairAttempts; attempt++) {
        signal.throwIfAborted();
        const raw = await model.complete(messages, AbortSignal.any([signal, AbortSignal.timeout(EXECUTION_LIMITS.modelTimeoutMs)]));
        signal.throwIfAborted();
        try {
          const response = JudgeModelResponseSchema.parse(JSON.parse(raw));
          validateCitations([], response, retrievedEvidence, retrievedPolicies);
          return response;
        } catch {
          if (attempt === EXECUTION_LIMITS.repairAttempts) throw new Error('Judge output failed schema or citation validation after one repair attempt.');
          emitter.emit({actor: 'judge', type: 'output.repair', summary: 'Judge output failed validation; one directed repair requested.'});
          messages.push({role: 'assistant', content: raw}, {role: 'user', content: 'Return only valid JSON matching the Judge schema. Use only evidence and policy IDs in the provided context. Do not include an action, amount, or recipient.'});
        }
      }
      throw new Error('Judge output validation failed.');
    }
  };
}
