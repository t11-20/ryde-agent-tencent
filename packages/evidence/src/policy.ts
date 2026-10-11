import type { PolicyClause } from '@fairtrip/contracts';
import type { PolicyDoc } from './schemas.js';

/** Filter the policy clauses by category, keep file order, return copies. */
export function policyClausesFor(policy: PolicyDoc, category: PolicyClause['category']): PolicyClause[] {
  return policy.clauses.filter(clause => clause.category === category).map(clause => ({ ...clause }));
}
