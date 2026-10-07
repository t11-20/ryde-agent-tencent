import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContractMismatchError, type ApiClient } from "./api/client";
import type { FixtureListItem } from "./contracts/provisional";
import { ActionCard } from "./components/ActionCard";
import { AdvocatePanel } from "./components/AdvocatePanel";
import { anchorId, CitationContext, type CitationIndex } from "./components/citations";
import { DisputePanel } from "./components/DisputePanel";
import { EvidenceViewer } from "./components/EvidenceViewer";
import { downloadExport } from "./components/exportRun";
import { JudgePanel } from "./components/JudgePanel";
import { StatusPanel } from "./components/StatusPanel";
import { Timeline } from "./components/Timeline";
import { SCENARIOS } from "./mock/scenarios";
import { isActive, useRun } from "./state/useRun";

export function App({ client, pollIntervalMs }: { client: ApiClient; pollIntervalMs?: number }) {
  const [fixtures, setFixtures] = useState<FixtureListItem[] | null>(null);
  const [fixturesError, setFixturesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [riderClaim, setRiderClaim] = useState("");
  const [mockScenario, setMockScenario] = useState("");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { state, start, keepWaiting, stopWaiting } = useRun(client, pollIntervalMs);
  const mock = client.mode === "mock";

  const loadFixtures = useCallback(() => {
    setFixturesError(null);
    client.listFixtures().then(
      (list) => {
        setFixtures(list);
        const first = list[0];
        if (first) { setSelectedId(first.fixtureId); setRiderClaim(first.riderClaim); }
      },
      (e: unknown) => setFixturesError(e instanceof ContractMismatchError ? `Contract mismatch on ${e.endpoint}.` : `${e instanceof Error ? e.message : String(e)}. Is the API running?`),
    );
  }, [client]);
  useEffect(loadFixtures, [loadFixtures]);
  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  const scenarios = mock ? (SCENARIOS[selectedId] ?? []) : undefined;
  const select = (id: string) => {
    setSelectedId(id);
    setRiderClaim(fixtures?.find((f) => f.fixtureId === id)?.riderClaim ?? "");
    setMockScenario(SCENARIOS[id]?.[0]?.id ?? "");
  };
  useEffect(() => { if (mock && !mockScenario) setMockScenario(SCENARIOS[selectedId]?.[0]?.id ?? ""); }, [mock, mockScenario, selectedId]);

  const resolve = () => {
    if (!selectedId) return;
    start({ fixtureId: selectedId, riderClaim, ...(mock && mockScenario ? { devScenario: mockScenario } : {}) });
  };

  const v = state.view;
  const citations: CitationIndex = useMemo(() => ({
    evidenceIds: new Set((v?.evidence ?? []).map((r) => r.id)),
    policyIds: new Set((v?.policyClauses ?? []).map((c) => c.id)),
    highlighted,
    focus: (id: string) => {
      document.getElementById(anchorId(id))?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      setHighlighted(id);
      clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlighted(null), 2500);
    },
  }), [v?.evidence, v?.policyClauses, highlighted]);

  return (
    <CitationContext.Provider value={citations}>
      <div className="app">
        <header className="app-header">
          <h1>FairTrip: Ryde Multi-Agent Dispute Resolution (prototype)</h1>
          <div className="header-badges">
            <span className="badge demo">DEMONSTRATION POLICY</span>
            <span className="badge synthetic">SYNTHETIC DATA</span>
            <button type="button" onClick={() => downloadExport(state, client.mode)} disabled={!state.runId}>Export run JSON</button>
          </div>
        </header>
        {mock && <div className="mock-banner" role="status">DEV MOCK: agent activity is scripted, not live.</div>}
        <main className="grid">
          <div className="col col-left">
            <DisputePanel
              fixtures={fixtures} fixturesError={fixturesError} onRetryFixtures={loadFixtures}
              selectedId={selectedId} onSelect={select} riderClaim={riderClaim} onRiderClaim={setRiderClaim}
              busy={isActive(state)} onResolve={resolve}
              mockScenarios={scenarios} mockScenario={mockScenario} onMockScenario={setMockScenario}
            />
            <StatusPanel state={state} onRunAgain={resolve} onKeepWaiting={keepWaiting} onStop={stopWaiting} />
            <ActionCard view={v} status={state.status} />
            <JudgePanel view={v} status={state.status} />
          </div>
          <div className="col col-mid">
            <div className="advocates">
              <AdvocatePanel side="rider" events={state.events} caseData={v?.cases?.rider} />
              <AdvocatePanel side="driver" events={state.events} caseData={v?.cases?.driver} />
            </div>
            <Timeline events={state.events} />
          </div>
          <div className="col col-right">
            <EvidenceViewer evidence={v?.evidence ?? []} clauses={v?.policyClauses ?? []} missing={v?.missingEvidence ?? []} />
          </div>
        </main>
      </div>
    </CitationContext.Provider>
  );
}
