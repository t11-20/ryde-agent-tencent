import { describe, it, expect } from 'vitest';
import { FinalActionSchema, JudgeResultSchema, JudgeModelResponseSchema, RunSchema, EvidenceSchema, ActivityEventSchema, validateCitations } from '@fairtrip/contracts';
import { catalog, examplesFor } from '../apps/api/src/catalog.js';

describe('shared contracts and examples', () => {
  it('validates source envelopes and every category with consistent citations', () => {
    expect(new Set(catalog.evidence.map(e => e.source)).size).toBe(4);
    for (const dispute of catalog.disputes) {
      const {cases, modelResponse, policies} = examplesFor(dispute);
      expect(() => validateCitations(cases, modelResponse, catalog.evidence, policies)).not.toThrow();
      // Build a complete JudgeResult with server-constructed action for Run validation
      const result = {...modelResponse, action: {remedyId: modelResponse.remedyId, recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Test action'}};
      expect(() => RunSchema.parse({id: 'run-example', fixtureId: dispute.id, mode: 'stub', status: 'completed', dispute, cases, events: [catalog.event], retrievedEvidence: [], retrievedPolicies: [], result})).not.toThrow();
    }
  });
  it.each([-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid amount %s', amountCents => {
    expect(FinalActionSchema.safeParse({remedyId: 'keep_charge', recipient: 'none', currency: 'SGD', amountCents, recommendation: 'Test'}).success).toBe(false);
  });
  it('rejects paid no-action, unsupported currency, mismatched remedy and invalid confidence', () => {
    expect(FinalActionSchema.safeParse({remedyId: 'keep_charge', recipient: 'none', currency: 'SGD', amountCents: 1, recommendation: 'Test'}).success).toBe(false);
    expect(FinalActionSchema.safeParse({remedyId: 'keep_charge', recipient: 'none', currency: 'USD', amountCents: 0, recommendation: 'Test'}).success).toBe(false);
    expect(JudgeModelResponseSchema.safeParse({...catalog.judgeResult, confidence: 1.01}).success).toBe(false);
    // JudgeResult requires matching remedyId and action.remedyId
    expect(JudgeResultSchema.safeParse({...catalog.judgeResult, remedyId: 'refund_no_show_fee', action: {remedyId: 'keep_charge', recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Test'}}).success).toBe(false);
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
    const result = {...catalog.judgeResult, action: {remedyId: catalog.judgeResult.remedyId, recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Test'}};
    const run = {id: 'run-example', fixtureId: catalog.disputes[0]!.id, mode: 'stub', status: 'completed', dispute: catalog.disputes[0], cases: [catalog.riderCase], events: [catalog.event], retrievedEvidence: [], retrievedPolicies: [], result};
    expect(RunSchema.safeParse(run).success).toBe(false);
    expect(RunSchema.safeParse({...run, cases: [catalog.riderCase, catalog.driverCase], events: [catalog.event, catalog.event]}).success).toBe(false);
    expect(RunSchema.safeParse({...run, cases: [catalog.riderCase, catalog.driverCase], events: [{...catalog.event, runId: 'other'}]}).success).toBe(false);
  });
  it('validates JudgeModelResponse separately from JudgeResult', () => {
    // JudgeModelResponse should NOT have an action field
    expect(JudgeModelResponseSchema.safeParse({...catalog.judgeResult, action: {remedyId: 'keep_charge', recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Test'}}).success).toBe(false);
    // JudgeResult MUST have an action field
    expect(JudgeResultSchema.safeParse(catalog.judgeResult).success).toBe(false);
  });
  it('accepts new event types in 0.2.0', () => {
    for (const type of ['model.start', 'model.finish', 'output.repair', 'run.incomplete']) {
      expect(ActivityEventSchema.safeParse({...catalog.event, type}).success).toBe(true);
    }
  });
});
