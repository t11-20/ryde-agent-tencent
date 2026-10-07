import type { PolicyDoc } from "../schemas/policy.js";

/** Read a numeric param from a policy clause. Thresholds are never hard-coded. */
export function clauseParam(policy: PolicyDoc, clauseId: string, param: string): number {
  const clause = policy.clauses.find((c) => c.id === clauseId);
  if (!clause) throw new Error(`policy ${policy.policyId} has no clause ${clauseId}`);
  const v = clause.params[param];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`policy clause ${clauseId} has no numeric param ${param}`);
  return v;
}

export interface Rd1Params { minExcessMeters: number; minExcessRatio: number }
export interface Ns1Params { maxPickupDistanceMeters: number; minWaitSeconds: number; minContactAttempts: number }

export const rd1Params = (p: PolicyDoc): Rd1Params => ({
  minExcessMeters: clauseParam(p, "RD-1", "minExcessMeters"),
  minExcessRatio: clauseParam(p, "RD-1", "minExcessRatio"),
});

export const ns1Params = (p: PolicyDoc): Ns1Params => ({
  maxPickupDistanceMeters: clauseParam(p, "NS-1", "maxPickupDistanceMeters"),
  minWaitSeconds: clauseParam(p, "NS-1", "minWaitSeconds"),
  minContactAttempts: clauseParam(p, "NS-1", "minContactAttempts"),
});
