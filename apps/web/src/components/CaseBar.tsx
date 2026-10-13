import { useId, useState } from 'react';
import type { FixtureItem } from '../lib/api.js';
import { categoryLabel } from '../lib/present.js';

interface CaseBarProps {
  fixtures: FixtureItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  claim: string;
  onClaimChange: (claim: string) => void;
  busy: boolean;
  onResolve: () => void;
}

export function CaseBar({fixtures, selectedId, onSelect, claim, onClaimChange, busy, onResolve}: CaseBarProps) {
  const [editingClaim, setEditingClaim] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const claimRegionId = useId();
  const statementRegionId = useId();
  const selectId = useId();
  const selected = fixtures.find(fixture => fixture.id === selectedId) ?? null;
  const riderClaim = selected === null ? undefined : selected.riderClaim;
  const driverStatement = selected === null ? undefined : selected.driverStatement;

  return (
    <section className="panel casebar" aria-label="Case">
      <div className="casebar-top">
        <label htmlFor={selectId} className="visually-hidden">Case</label>
        <select id={selectId} className="casebar-select" value={selectedId} onChange={event => { onSelect(event.target.value); }}>
          {fixtures.length === 0 ? <option value="">Loading cases…</option> : null}
          {fixtures.map(fixture => (
            <option key={fixture.id} value={fixture.id}>{`${fixture.id} ${fixture.label}`}</option>
          ))}
        </select>
        {selected === null ? null : <span className="casebar-category">{categoryLabel(selected.category)}</span>}
        <button type="button" className="btn-primary casebar-resolve" onClick={onResolve} disabled={busy}>Resolve dispute</button>
      </div>
      <div className="casebar-claims">
        <div className="casebar-claim">
          <span className="casebar-claim-label">Rider claim</span>
          {riderClaim === undefined ? (
            <span className="casebar-muted">Claim appears when the run starts</span>
          ) : (
            <>
              <div className="casebar-claim-row">
                <span className={editingClaim ? 'casebar-line' : 'clamp clamp-2'} title={claim}>{claim}</span>
                <button
                  type="button"
                  className="btn-text"
                  aria-expanded={editingClaim}
                  aria-controls={claimRegionId}
                  onClick={() => { setEditingClaim(value => !value); }}
                >
                  {editingClaim ? 'Done' : 'Edit'}
                </button>
              </div>
              {editingClaim ? (
                <textarea id={claimRegionId} className="casebar-textarea" rows={4} value={claim} onChange={event => { onClaimChange(event.target.value); }} aria-label="Rider claim" />
              ) : null}
            </>
          )}
        </div>
        <div className="casebar-claim">
          <span className="casebar-claim-label">Driver statement</span>
          {driverStatement === undefined ? (
            <span className="casebar-muted">Driver statement appears when the run starts</span>
          ) : (
            <div className="casebar-claim-row">
              <span id={statementRegionId} className={showStatement ? 'casebar-line' : 'clamp clamp-2'}>{driverStatement}</span>
              <button
                type="button"
                className="btn-text"
                aria-expanded={showStatement}
                aria-controls={statementRegionId}
                onClick={() => { setShowStatement(value => !value); }}
              >
                {showStatement ? 'Show less' : 'Show all'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
