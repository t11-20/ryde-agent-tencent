import { describe, it, expect } from 'vitest';
import { JudgeModelResponseSchema, AdvocateResponseSchema } from '@fairtrip/contracts';
import { normaliseJudgeOutput, normaliseAdvocateOutput } from '@fairtrip/agents';

const judgeBase = {
  ruling: 'driver_favored', findings: [{claim: 'GPS proves arrival.', evidenceIds: ['GPS-1'], policyClauseIds: ['RD-1']}],
  remedyId: 'keep_charge', confidence: 0.9,
  reasoning: 'Reasoning.', riderExplanation: 'Rider.', driverExplanation: 'Driver.'
};

const advocateCase = {
  side: 'rider', summary: 'Detour without consent.',
  arguments: [{claim: 'Too far.', evidenceIds: ['GPS-1'], policyClauseIds: []}],
  counterevidence: [], requestedRemedyId: 'refund_route_excess', missingFacts: []
};

describe('normaliseJudgeOutput', () => {
  it('removes unknown top-level keys and notes only the key name', () => {
    const {value, notes} = normaliseJudgeOutput({...judgeBase, riskNote: 'secret model text', extra: 1});
    expect(value).toMatchObject(judgeBase);
    expect(value).not.toHaveProperty('riskNote');
    expect(value).not.toHaveProperty('extra');
    expect(notes).toEqual(['unknown key removed: riskNote', 'unknown key removed: extra']);
    expect(notes.join(' ')).not.toContain('secret model text');
  });

  it('leaves money-like keys in place so the strict schema still rejects them', () => {
    for (const key of ['action', 'amountCents', 'recipient', 'currency', 'refund_total', 'payCents']) {
      const {value, notes} = normaliseJudgeOutput({...judgeBase, [key]: 1});
      expect(value).toHaveProperty(key);
      expect(notes.some(note => note.includes(key))).toBe(false);
      expect(JudgeModelResponseSchema.safeParse(value).success).toBe(false);
    }
  });

  it('derives a missing ruling from a valid remedyId', () => {
    const keep = normaliseJudgeOutput({...judgeBase, ruling: undefined});
    expect((keep.value as {ruling: string}).ruling).toBe('driver_favored');
    expect(keep.notes).toEqual(['ruling derived from remedy']);
    const refund = normaliseJudgeOutput({...judgeBase, ruling: undefined, remedyId: 'refund_route_excess'});
    expect((refund.value as {ruling: string}).ruling).toBe('rider_favored');
  });

  it('derives an invalid ruling from the remedy without echoing the invalid value', () => {
    const {value, notes} = normaliseJudgeOutput({...judgeBase, ruling: 'driver_favoured'});
    expect((value as {ruling: string}).ruling).toBe('driver_favored');
    expect(notes).toEqual(['ruling derived from remedy']);
    expect(notes.join(' ')).not.toContain('favoured');
    expect(JudgeModelResponseSchema.safeParse(value).success).toBe(true);
  });

  it('leaves an invalid ruling alone when remedyId is also invalid', () => {
    const {value, notes} = normaliseJudgeOutput({...judgeBase, ruling: 'maybe', remedyId: 'refund_everything'});
    expect((value as {ruling: string}).ruling).toBe('maybe');
    expect(notes).toEqual([]);
    expect(JudgeModelResponseSchema.safeParse(value).success).toBe(false);
  });

  it('coerces finding id lists: absent/null to [], a single string to an array', () => {
    const {value, notes} = normaliseJudgeOutput({
      ...judgeBase,
      findings: [
        {claim: 'a'},
        {claim: 'b', evidenceIds: null, policyClauseIds: 'RD-1'},
        {claim: 'c', evidenceIds: ['GPS-1'], policyClauseIds: ['RD-1']}
      ]
    });
    const findings = (value as {findings: {evidenceIds: string[]; policyClauseIds: string[]}[]}).findings;
    expect(findings[0]).toMatchObject({evidenceIds: [], policyClauseIds: []});
    expect(findings[1]).toMatchObject({evidenceIds: [], policyClauseIds: ['RD-1']});
    expect(findings[2]).toMatchObject({evidenceIds: ['GPS-1'], policyClauseIds: ['RD-1']});
    expect(notes).toEqual([
      'findings[0].evidenceIds defaulted to []',
      'findings[0].policyClauseIds defaulted to []',
      'findings[1].evidenceIds defaulted to []',
      'findings[1].policyClauseIds wrapped in an array'
    ]);
    expect(JudgeModelResponseSchema.safeParse(value).success).toBe(true);
  });

  it('leaves findings absent for repair while still deriving the ruling', () => {
    const rest = {...judgeBase} as Record<string, unknown>;
    delete rest.ruling;
    delete rest.findings;
    const {value, notes} = normaliseJudgeOutput(rest);
    expect(value).not.toHaveProperty('findings');
    expect(value).toMatchObject({ruling: 'driver_favored'});
    expect(notes).toEqual(['ruling derived from remedy']);
    expect(JudgeModelResponseSchema.safeParse(value).success).toBe(false);
  });

  it('never touches remedyId, confidence, reasoning, explanations or citation ids', () => {
    const {value} = normaliseJudgeOutput({...judgeBase, riskNote: 'x'});
    expect(value).toMatchObject({
      remedyId: 'keep_charge', confidence: 0.9, reasoning: 'Reasoning.',
      riderExplanation: 'Rider.', driverExplanation: 'Driver.'
    });
  });
});

describe('normaliseAdvocateOutput', () => {
  it('infers type=final_case from a case object', () => {
    const {value, notes} = normaliseAdvocateOutput({case: advocateCase});
    expect(value).toMatchObject({type: 'final_case'});
    expect(notes).toEqual(['type set to final_case']);
    expect(AdvocateResponseSchema.safeParse(value).success).toBe(true);
  });

  it('infers type=tool_request from a tools array and repairs an invalid type', () => {
    const tools = [{name: 'get_evidence', input: {sources: ['gps']}}];
    const {value, notes} = normaliseAdvocateOutput({type: 'tools', tools});
    expect(value).toMatchObject({type: 'tool_request'});
    expect(notes).toEqual(['type set to tool_request']);
    expect(AdvocateResponseSchema.safeParse(value).success).toBe(true);
  });

  it('removes unknown keys at response and case level', () => {
    const {value, notes} = normaliseAdvocateOutput({
      type: 'final_case', note: 'x', case: {...advocateCase, scratch: 'y'}
    });
    expect(value).not.toHaveProperty('note');
    expect((value as {case: object}).case).not.toHaveProperty('scratch');
    expect(notes).toEqual(['unknown key removed: note', 'unknown key removed: case.scratch']);
    expect(AdvocateResponseSchema.safeParse(value).success).toBe(true);
  });

  it('defaults counterevidence and missingFacts and wraps single strings', () => {
    const rest = {...advocateCase} as Record<string, unknown>;
    delete rest.counterevidence;
    delete rest.missingFacts;
    const {value, notes} = normaliseAdvocateOutput({type: 'final_case', case: rest});
    expect((value as {case: object}).case).toMatchObject({counterevidence: [], missingFacts: []});
    expect(notes).toEqual(['case.counterevidence defaulted to []', 'case.missingFacts defaulted to []']);
    const wrapped = normaliseAdvocateOutput({type: 'final_case', case: {...advocateCase, missingFacts: 'gps log'}});
    expect((wrapped.value as {case: {missingFacts: string[]}}).case.missingFacts).toEqual(['gps log']);
  });

  it('coerces argument and counterevidence id lists', () => {
    const {value, notes} = normaliseAdvocateOutput({
      type: 'final_case',
      case: {
        ...advocateCase,
        arguments: [{claim: 'a'}],
        counterevidence: [{claim: 'b', evidenceIds: 'GPS-1', policyClauseIds: null}]
      }
    });
    const caseOut = (value as {case: {arguments: {evidenceIds: string[]}[]; counterevidence: {evidenceIds: string[]; policyClauseIds: string[]}[]}}).case;
    expect(caseOut.arguments[0]).toMatchObject({evidenceIds: [], policyClauseIds: []});
    expect(caseOut.counterevidence[0]).toMatchObject({evidenceIds: ['GPS-1'], policyClauseIds: []});
    expect(notes).toEqual([
      'case.arguments[0].evidenceIds defaulted to []',
      'case.arguments[0].policyClauseIds defaulted to []',
      'case.counterevidence[0].evidenceIds wrapped in an array',
      'case.counterevidence[0].policyClauseIds defaulted to []'
    ]);
    expect(AdvocateResponseSchema.safeParse(value).success).toBe(true);
  });

  it('drops an invalid requestedRemedyId and keeps a valid one', () => {
    const bad = normaliseAdvocateOutput({type: 'final_case', case: {...advocateCase, requestedRemedyId: 'refund_all'}});
    expect((bad.value as {case: object}).case).not.toHaveProperty('requestedRemedyId');
    expect(bad.notes).toEqual(['requestedRemedyId dropped (not a permitted remedy)']);
    expect(AdvocateResponseSchema.safeParse(bad.value).success).toBe(true);
    const good = normaliseAdvocateOutput({type: 'final_case', case: advocateCase});
    expect((good.value as {case: {requestedRemedyId: string}}).case.requestedRemedyId).toBe('refund_route_excess');
    expect(good.notes).toEqual([]);
  });

  it('never touches claim text, summary, side or id values', () => {
    const {value} = normaliseAdvocateOutput({type: 'final_case', case: {...advocateCase, scratch: 'x'}});
    expect((value as {case: object}).case).toMatchObject({
      side: 'rider', summary: 'Detour without consent.',
      arguments: [{claim: 'Too far.', evidenceIds: ['GPS-1'], policyClauseIds: []}]
    });
  });

  it('leaves non-object input alone', () => {
    expect(normaliseJudgeOutput('nope')).toEqual({value: 'nope', notes: []});
    expect(normaliseAdvocateOutput(null)).toEqual({value: null, notes: []});
  });
});
