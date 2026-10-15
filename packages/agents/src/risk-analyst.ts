import { z } from 'zod';
import { RiskAssessmentSchema } from '@fairtrip/contracts';
import type { Dispute, Evidence, RiskAssessment } from '@fairtrip/contracts';
import { EXECUTION_LIMITS } from './index.js';
import type { ModelAdapter } from './index.js';
import { extractJsonText } from './json-output.js';
import { riskAnalystPrompt } from './prompts.js';

export const RiskAnalystModelResponseSchema = z.strictObject({ summary: z.string().trim().min(1).max(600) });

// The model may only rephrase the summary; signals always come from the
// deterministic assessment. Any failure falls back to that assessment.
export async function runRiskAnalyst(
  dispute: Dispute,
  deterministic: RiskAssessment,
  records: Evidence[],
  model: ModelAdapter,
  signal: AbortSignal,
  systemPromptSuffix = '',
): Promise<RiskAssessment> {
  const messages: {role: 'system' | 'user' | 'assistant'; content: string}[] = [
    {role: 'system', content: riskAnalystPrompt(dispute) + systemPromptSuffix},
    {role: 'user', content: JSON.stringify({signals: deterministic.signals, overall: deterministic.overall, records})},
  ];
  for (let attempt = 0; attempt <= EXECUTION_LIMITS.repairAttempts; attempt++) {
    signal.throwIfAborted();
    let raw: string | undefined;
    try {
      // Rephrasing-only call: thinking stays off and no hedge is needed since a
      // failure already falls back to the deterministic assessment.
      raw = await model.complete(messages, AbortSignal.any([signal, AbortSignal.timeout(EXECUTION_LIMITS.modelTimeoutMs)]), {thinking: 'off'});
      const parsed = RiskAnalystModelResponseSchema.parse(JSON.parse(extractJsonText(raw)));
      if (parsed.summary.includes('<think>') || parsed.summary.includes('</think>'))
        throw new Error('Risk analyst summary contains a think block');
      return RiskAssessmentSchema.parse({...deterministic, summary: parsed.summary, source: 'model'});
    } catch (error) {
      if (signal.aborted) throw error;
      if (attempt === EXECUTION_LIMITS.repairAttempts) return deterministic;
      if (raw !== undefined) messages.push({role: 'assistant', content: raw});
      messages.push({role: 'user', content: 'Return only {"summary": "..."} as valid JSON.'});
    }
  }
  return deterministic;
}
