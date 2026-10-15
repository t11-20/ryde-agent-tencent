import type { PolicyClause } from '@fairtrip/contracts';
import { clauseLabel, partitionClauses } from '../lib/present.js';

interface PolicyPanelProps { policies: PolicyClause[]; citedIds: string[] }

function ClauseItem({clause}: {clause: PolicyClause}) {
  return (
    <li id={`pol-${clause.id}`} className="policy-clause">
      <h3 className="policy-heading">{clauseLabel(clause.id)} <span className="mono policy-id">{clause.id}</span></h3>
      <p className="policy-rule">{clause.ruleText}</p>
      <p className="policy-criteria">{clause.remedyCriteria}</p>
    </li>
  );
}

export function PolicyPanel({policies, citedIds}: PolicyPanelProps) {
  const {cited, rest} = partitionClauses(policies, citedIds);
  if (policies.length === 0) return null;
  return (
    <section className="panel policy" aria-labelledby="policy-heading">
      <h2 id="policy-heading" className="panel-title">Policy applied <span className="policy-note">Demonstration policy</span></h2>
      <ul className="policy-list">
        {(cited.length === 0 ? rest : cited).map(clause => <ClauseItem key={clause.id} clause={clause} />)}
      </ul>
      {cited.length === 0 ? null : rest.length === 0 ? null : (
        <details className="policy-more">
          <summary>{`${rest.length} more clauses retrieved`}</summary>
          <ul className="policy-list">
            {rest.map(clause => <ClauseItem key={clause.id} clause={clause} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
