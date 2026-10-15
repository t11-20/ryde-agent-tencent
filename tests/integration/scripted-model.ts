import { z } from 'zod';
import type { ModelAdapter } from '@fairtrip/agents';
import { findExpected, findFixtureByDisputeId, loadDataset } from '@fairtrip/evidence';

// SPEC §10: a deterministic test double that drives the real workflow, tools,
// evidence and money without a network. Never used by the server.
export type ScriptedModel = ModelAdapter & { calls: { rider: number; driver: number; judge: number; risk: number } };

type Role = 'rider' | 'driver' | 'judge' | 'risk';
type Message = { role: 'system' | 'user' | 'assistant'; content: string };

const idListSchema = z.array(z.object({ id: z.string() }));
const judgeContextSchema = z.object({
  evidence: z.array(z.object({ id: z.string() })),
  policies: z.array(z.object({ id: z.string() }))
});

function roleOf(system: string): Role {
  if (system.startsWith('You are the Risk Analyst')) return 'risk';
  if (system.startsWith('You are the Rider Advocate')) return 'rider';
  if (system.startsWith('You are the Driver Advocate')) return 'driver';
  if (system.startsWith('You are the Judge')) return 'judge';
  throw new Error('Scripted model: unrecognized system prompt');
}

function promptLine(system: string, label: string): string {
  const prefix = `${label}: `;
  for (const line of system.split('\n')) {
    if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
  }
  throw new Error(`Scripted model: system prompt has no ${label} line`);
}

/** IDs from the JSON payload after the first newline of a tool-result message. */
function retrievalIds(messages: Message[], header: string): string[] {
  const message = messages.find(m => m.role === 'user' && m.content.startsWith(header));
  if (message === undefined) throw new Error(`Scripted model: no message starting with "${header}"`);
  const newline = message.content.indexOf('\n');
  if (newline === -1) throw new Error(`Scripted model: message "${header}" has no JSON body`);
  return idListSchema.parse(JSON.parse(message.content.slice(newline + 1))).map(item => item.id);
}

export function createScriptedModel(): ScriptedModel {
  const dataset = loadDataset();
  const calls = { rider: 0, driver: 0, judge: 0, risk: 0 };
  return {
    calls,
    async complete(messages) {
      const system = messages[0]?.content ?? '';
      const role = roleOf(system);
      calls[role] += 1;
      if (role === 'risk') return '{"summary": "Scripted risk summary."}';
      const disputeId = promptLine(system, 'DISPUTE ID');
      const fixture = findFixtureByDisputeId(dataset, disputeId);
      if (fixture === undefined) throw new Error(`Scripted model: unknown dispute ${disputeId}`);
      const expected = findExpected(dataset, fixture.fixtureId);
      if (expected === undefined) throw new Error(`Scripted model: no expected outcome for ${fixture.fixtureId}`);

      if (role === 'judge') {
        const contextMessage = messages[1];
        if (contextMessage === undefined) throw new Error('Scripted model: judge context message missing');
        const context = judgeContextSchema.parse(JSON.parse(contextMessage.content));
        const evidenceIds = new Set(context.evidence.map(item => item.id));
        const policyIds = new Set(context.policies.map(item => item.id));
        return JSON.stringify({
          ruling: expected.expectedRuling ?? 'incomplete',
          findings: [{
            claim: 'Scripted test double finding based on the expected outcome.',
            evidenceIds: expected.decisiveEvidenceIds.filter(id => evidenceIds.has(id)),
            policyClauseIds: expected.keyClauseIds.filter(id => policyIds.has(id))
          }],
          remedyId: expected.expectedRemedyId ?? 'keep_charge',
          confidence: 0.9,
          reasoning: 'Scripted test double: ruling and remedy copied from the expected-outcome dataset.',
          riderExplanation: 'Scripted test double explanation for the rider.',
          driverExplanation: 'Scripted test double explanation for the driver.'
        });
      }

      const hasRetrievedEvidence = messages.some(m => m.role === 'user' && m.content.startsWith('Evidence retrieval results:'));
      if (!hasRetrievedEvidence) {
        return JSON.stringify({
          type: 'tool_request',
          tools: [
            { name: 'get_evidence', input: { sources: ['gps', 'chat', 'payment', 'history'] } },
            { name: 'get_policy', input: { category: promptLine(system, 'CATEGORY') } }
          ]
        });
      }
      const firstEvidence = retrievalIds(messages, 'Evidence retrieval results:')[0];
      const firstPolicy = retrievalIds(messages, 'Policy retrieval results:')[0];
      const requestedRemedyId = role === 'driver'
        ? 'keep_charge'
        : expected.category === 'route_deviation' ? 'refund_route_excess' : 'refund_no_show_fee';
      return JSON.stringify({
        type: 'final_case',
        case: {
          side: role,
          summary: `Scripted ${role} advocate case (test double).`,
          arguments: [{
            claim: `Scripted ${role} argument citing the first retrieved evidence and policy (test double).`,
            evidenceIds: firstEvidence === undefined ? [] : [firstEvidence],
            policyClauseIds: firstPolicy === undefined ? [] : [firstPolicy]
          }],
          counterevidence: [],
          requestedRemedyId,
          missingFacts: []
        }
      });
    }
  };
}
