import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { DisputeSchema, EvidenceSchema, PolicyClauseSchema, AdvocateCaseSchema, JudgeModelResponseSchema, ActivityEventSchema, FixtureSummarySchema, validateCitations } from '@fairtrip/contracts';
const CatalogSchema = z.strictObject({
  notice: z.string(), disputes: z.array(DisputeSchema).min(1), evidence: z.array(EvidenceSchema), policies: z.array(PolicyClauseSchema),
  riderCase: AdvocateCaseSchema, driverCase: AdvocateCaseSchema, judgeResult: JudgeModelResponseSchema, event: ActivityEventSchema
});
export const catalog = CatalogSchema.parse(JSON.parse(readFileSync(new URL('../../../examples/catalog.json', import.meta.url), 'utf8')));
validateCitations([catalog.riderCase, catalog.driverCase], catalog.judgeResult, catalog.evidence, catalog.policies);
export const fixtures = catalog.disputes.map(dispute => FixtureSummarySchema.parse({
  id: dispute.id, category: dispute.category, label: `${dispute.category} — development contract example`, kind: 'contract_example'
}));
export function examplesFor(dispute: typeof catalog.disputes[number]) {
  const clause = catalog.policies.find(p => p.category === dispute.category);
  if (!clause) throw new Error('No placeholder policy for category');
  const cases = [catalog.riderCase, catalog.driverCase].map(value => ({
    ...structuredClone(value), arguments: value.arguments.map(a => ({...a, policyClauseIds: [clause.id]}))
  }));
  const modelResponse = {...structuredClone(catalog.judgeResult), findings: catalog.judgeResult.findings.map(f => ({...f, policyClauseIds: [clause.id]}))};
  return {cases, modelResponse, policies: [clause]};
}
