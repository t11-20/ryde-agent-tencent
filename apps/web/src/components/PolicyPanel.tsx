import type { PolicyClause } from '@fairtrip/contracts';

interface PolicyPanelProps { policies: PolicyClause[] }

export function PolicyPanel({policies}: PolicyPanelProps) {
  return (
    <section className="panel" aria-labelledby="policy-heading">
      <h2 id="policy-heading" className="panel-title">Policy clauses retrieved (DEMONSTRATION POLICY)</h2>
      {policies.length === 0 ? (
        <p className="placeholder">No policy clauses retrieved.</p>
      ) : (
        <ul className="policy-list">
          {policies.map(clause => (
            <li key={clause.id} id={`pol-${clause.id}`} className="policy-clause">
              <h3 className="policy-id">{clause.id}</h3>
              <p className="policy-rule">{clause.ruleText}</p>
              <p className="policy-criteria">{clause.remedyCriteria}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
