import { describe, it, expect } from 'vitest';
import { FinalActionSchema, JudgeResultSchema, RunSchema, EvidenceSchema, validateCitations } from '@fairtrip/contracts';
import { catalog, examplesFor } from '../apps/api/src/catalog.js';

describe('shared contracts and examples', () => {
  it('validates source envelopes and every category with consistent citations', () => {
    expect(new Set(catalog.evidence.map(e => e.source)).size).toBe(4);
    for (const dispute of catalog.disputes) {
      const {cases, result, policies} = examplesFor(dispute);
      expect(() => validateCitations(cases, result, catalog.evidence, policies)).not.toThrow();
      expect(() => RunSchema.parse({id: 'run-example', fixtureId: dispute.id, mode: 'stub', status: 'completed', dispute, cases, events: [catalog.event], result})).not.toThrow();
    }
  });
  it.each([-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid amount %s', amountCents => {
    expect(FinalActionSchema.safeParse({...catalog.judgeResult.action, amountCents}).success).toBe(false);
  });
  it('rejects paid no-action, unsupported currency, mismatched remedy and invalid confidence', () => {
    expect(FinalActionSchema.safeParse({...catalog.judgeResult.action, amountCents: 1}).success).toBe(false);
    expect(FinalActionSchema.safeParse({...catalog.judgeResult.action, currency: 'USD'}).success).toBe(false);
    expect(JudgeResultSchema.safeParse({...catalog.judgeResult, confidence: 1.01}).success).toBe(false);
    expect(JudgeResultSchema.safeParse({...catalog.judgeResult, remedyId: 'refund_no_show_fee'}).success).toBe(false);
  });
  it('rejects invented citations and duplicate source identifiers', () => {
    const invalid = structuredClone(catalog.riderCase);
    invalid.arguments[0]!.evidenceIds = ['invented'];
    expect(() => validateCitations([invalid], undefined, catalog.evidence, catalog.policies)).toThrow('Unknown evidence');
    invalid.arguments[0]!.evidenceIds = ['e-gps'];
    invalid.arguments[0]!.policyClauseIds = ['invented'];
    expect(() => validateCitations([invalid], undefined, catalog.evidence, catalog.policies)).toThrow('Unknown policy');
    expect(() => validateCitations([], undefined, [...catalog.evidence, catalog.evidence[0]!], catalog.policies)).toThrow('Duplicate');
  });
  it('requires provenance without imposing a partner-specific payload', () => {
    const {provenance: _, ...value} = catalog.evidence[0]!;
    expect(EvidenceSchema.safeParse(value).success).toBe(false);
    expect(EvidenceSchema.safeParse({...catalog.evidence[0], facts: {newPartnerField: {nested: true}}}).success).toBe(true);
  });
  it('rejects a completed run without both cases or with misordered/foreign events', () => {
    const run = {id: 'run-example', fixtureId: catalog.disputes[0]!.id, mode: 'stub', status: 'completed', dispute: catalog.disputes[0], cases: [catalog.riderCase], events: [catalog.event], result: catalog.judgeResult};
    expect(RunSchema.safeParse(run).success).toBe(false);
    expect(RunSchema.safeParse({...run, cases: [catalog.riderCase, catalog.driverCase], events: [catalog.event, catalog.event]}).success).toBe(false);
    expect(RunSchema.safeParse({...run, cases: [catalog.riderCase, catalog.driverCase], events: [{...catalog.event, runId: 'other'}]}).success).toBe(false);
  });
});
