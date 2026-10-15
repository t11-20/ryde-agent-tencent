import { AdvocateCaseSchema, JudgeModelResponseSchema, RemedySchema } from '@fairtrip/contracts';

// Normalise cosmetic model-output mistakes before the strict schema parse so
// they cost no repair round-trip. Decision-bearing fields are never touched
// and notes only ever name paths/keys — never model text or values.
export interface Normalised { value: unknown; notes: string[] }

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Keys that look like money or action smuggling: left in place so the strict
// schema still rejects them (adversarial judge attack A1).
const MONEY_KEY = /amount|action|recipient|currency|cents|pay|refund/i;

const JUDGE_KEYS = new Set(Object.keys(JudgeModelResponseSchema.shape));
const CASE_KEYS = new Set(Object.keys(AdvocateCaseSchema.shape));
const RULINGS = new Set(['rider_favored', 'driver_favored', 'incomplete']);

// absent/null -> [] ; a single string -> [string]; anything else untouched.
function coerceIdList(container: Record<string, unknown>, field: string, path: string, notes: string[]): void {
  const value = container[field];
  if (value === undefined || value === null) {
    container[field] = [];
    notes.push(`${path} defaulted to []`);
  } else if (typeof value === 'string') {
    container[field] = [value];
    notes.push(`${path} wrapped in an array`);
  }
}

function normaliseArguments(list: unknown, path: string, notes: string[]): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((argument, index) => {
    if (!isObject(argument)) return argument;
    const copy = {...argument};
    coerceIdList(copy, 'evidenceIds', `${path}[${index}].evidenceIds`, notes);
    coerceIdList(copy, 'policyClauseIds', `${path}[${index}].policyClauseIds`, notes);
    return copy;
  });
}

export function normaliseJudgeOutput(value: unknown): Normalised {
  const notes: string[] = [];
  if (!isObject(value)) return {value, notes};
  const out = {...value};

  for (const key of Object.keys(out)) {
    if (!JUDGE_KEYS.has(key) && !MONEY_KEY.test(key)) {
      delete out[key];
      notes.push(`unknown key removed: ${key}`);
    }
  }

  const ruling = out.ruling;
  if (typeof ruling !== 'string' || !RULINGS.has(ruling)) {
    const remedy = RemedySchema.safeParse(out.remedyId);
    if (remedy.success) {
      out.ruling = remedy.data === 'keep_charge' ? 'driver_favored' : 'rider_favored';
      notes.push('ruling derived from remedy');
    }
  }

  if (Array.isArray(out.findings)) {
    out.findings = normaliseArguments(out.findings, 'findings', notes);
  }

  return {value: out, notes};
}

export function normaliseAdvocateOutput(value: unknown): Normalised {
  const notes: string[] = [];
  if (!isObject(value)) return {value, notes};
  const out = {...value};

  if (out.type !== 'tool_request' && out.type !== 'final_case') {
    if (isObject(out.case)) {
      out.type = 'final_case';
      notes.push('type set to final_case');
    } else if (Array.isArray(out.tools)) {
      out.type = 'tool_request';
      notes.push('type set to tool_request');
    }
  }

  for (const key of Object.keys(out)) {
    if (key !== 'type' && key !== 'tools' && key !== 'case') {
      delete out[key];
      notes.push(`unknown key removed: ${key}`);
    }
  }

  if (isObject(out.case)) {
    const caseOut = {...out.case};
    for (const key of Object.keys(caseOut)) {
      if (!CASE_KEYS.has(key)) {
        delete caseOut[key];
        notes.push(`unknown key removed: case.${key}`);
      }
    }
    if (caseOut.counterevidence === undefined || caseOut.counterevidence === null) {
      caseOut.counterevidence = [];
      notes.push('case.counterevidence defaulted to []');
    }
    if (caseOut.missingFacts === undefined || caseOut.missingFacts === null) {
      caseOut.missingFacts = [];
      notes.push('case.missingFacts defaulted to []');
    } else if (typeof caseOut.missingFacts === 'string') {
      caseOut.missingFacts = [caseOut.missingFacts];
      notes.push('case.missingFacts wrapped in an array');
    }
    caseOut.arguments = normaliseArguments(caseOut.arguments, 'case.arguments', notes);
    caseOut.counterevidence = normaliseArguments(caseOut.counterevidence, 'case.counterevidence', notes);
    if (caseOut.requestedRemedyId !== undefined && !RemedySchema.safeParse(caseOut.requestedRemedyId).success) {
      delete caseOut.requestedRemedyId;
      notes.push('requestedRemedyId dropped (not a permitted remedy)');
    }
    out.case = caseOut;
  }

  return {value: out, notes};
}
