import type { FixtureListItem } from "../contracts/provisional";
import type { ScenarioOption } from "../mock/scenarios";

export interface DisputePanelProps {
  fixtures: FixtureListItem[] | null;
  fixturesError: string | null;
  onRetryFixtures(): void;
  selectedId: string;
  onSelect(id: string): void;
  riderClaim: string;
  onRiderClaim(v: string): void;
  busy: boolean;
  onResolve(): void;
  mockScenarios?: ScenarioOption[];
  mockScenario?: string;
  onMockScenario?(id: string): void;
}

export function DisputePanel(p: DisputePanelProps) {
  const selected = p.fixtures?.find((f) => f.fixtureId === p.selectedId);
  return (
    <section className="panel dispute-panel" aria-label="Dispute">
      <h2>Dispute</h2>
      {p.fixturesError && (
        <div className="state state-failed" role="alert">
          <strong>Could not load fixtures.</strong> {p.fixturesError}{" "}
          <button type="button" onClick={p.onRetryFixtures}>Retry</button>
        </div>
      )}
      <label className="field">
        <span>Fixture</span>
        <select value={p.selectedId} onChange={(e) => p.onSelect(e.target.value)} disabled={!p.fixtures || p.busy}>
          {(p.fixtures ?? []).map((f) => (
            <option key={f.fixtureId} value={f.fixtureId}>
              {f.fixtureId} · {f.label} · {f.category}
            </option>
          ))}
        </select>
      </label>
      {p.mockScenarios && (
        <label className="field">
          <span>DEV MOCK scenario</span>
          <select value={p.mockScenario ?? ""} onChange={(e) => p.onMockScenario?.(e.target.value)} disabled={p.busy}>
            {p.mockScenarios.length === 0 && <option value="">No scripted run for this fixture (will fail)</option>}
            {p.mockScenarios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      )}
      {selected && (
        <>
          <div className="meta">
            <span className="mono">{selected.disputeId}</span> · Category <strong>{selected.category}</strong> · {selected.purpose}
          </div>
          <label className="field">
            <span>Rider claim (editable)</span>
            <textarea value={p.riderClaim} onChange={(e) => p.onRiderClaim(e.target.value)} rows={4} disabled={p.busy} />
          </label>
          <div className="field">
            <span>Driver statement</span>
            <p className="readonly">{selected.driverStatement}</p>
          </div>
        </>
      )}
      <button type="button" className="primary" onClick={p.onResolve} disabled={p.busy || !selected}>
        Resolve
      </button>
    </section>
  );
}
