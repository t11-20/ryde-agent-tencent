import type { FixtureItem } from '../lib/api.js';

interface DisputePanelProps {
  fixtures: FixtureItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  claim: string;
  onClaimChange: (claim: string) => void;
  busy: boolean;
  onResolve: () => void;
}

export function DisputePanel({fixtures, selectedId, onSelect, claim, onClaimChange, busy, onResolve}: DisputePanelProps) {
  const selected = fixtures.find(fixture => fixture.id === selectedId) ?? null;
  return (
    <section className="panel" aria-labelledby="dispute-heading">
      <h2 id="dispute-heading" className="panel-title">Dispute</h2>
      <label className="field">
        <span className="field-label">Fixture</span>
        <select value={selectedId} onChange={event => { onSelect(event.target.value); }}>
          {fixtures.length === 0 ? <option value="">Loading fixtures…</option> : null}
          {fixtures.map(fixture => (
            <option key={fixture.id} value={fixture.id}>{`${fixture.id}: ${fixture.label}`}</option>
          ))}
        </select>
      </label>
      {selected === null ? null : (
        <>
          <p className="field-note">Category: {selected.category}</p>
          {selected.riderClaim === undefined ? (
            <p className="field-note">Claim appears when the run starts</p>
          ) : (
            <label className="field">
              <span className="field-label">Rider claim (editable)</span>
              <textarea rows={4} value={claim} onChange={event => { onClaimChange(event.target.value); }} />
            </label>
          )}
          <div className="field">
            <span className="field-label">Driver statement</span>
            {selected.driverStatement === undefined ? (
              <p className="field-note">Driver statement appears when the run starts</p>
            ) : (
              <p className="statement">{selected.driverStatement}</p>
            )}
          </div>
          <button type="button" className="resolve-button" onClick={onResolve} disabled={busy}>Resolve dispute</button>
        </>
      )}
    </section>
  );
}
