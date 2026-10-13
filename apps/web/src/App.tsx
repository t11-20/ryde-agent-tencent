import { useEffect, useMemo, useState } from 'react';
import type { PolicyClause } from '@fairtrip/contracts';
import { AdvocatePanel } from './components/AdvocatePanel.js';
import { Bench } from './components/Bench.js';
import { CaseBar } from './components/CaseBar.js';
import { ChipContext } from './components/Chip.js';
import type { ChipContextValue } from './components/Chip.js';
import { EvidencePanel } from './components/EvidencePanel.js';
import { Header } from './components/Header.js';
import { HearingLines } from './components/HearingLines.js';
import { JudgePanel } from './components/JudgePanel.js';
import { PolicyPanel } from './components/PolicyPanel.js';
import { useFixtures } from './hooks/useFixtures.js';
import { useRunPolling } from './hooks/useRunPolling.js';
import type { FixtureItem } from './lib/api.js';
import { buildExport, downloadJson, exportFileName } from './lib/export.js';
import { evidenceLabel, pageState } from './lib/present.js';
import { buildViewModel } from './lib/view-model.js';
import type { EvidenceCard, Family, SidePanel } from './lib/view-model.js';

const EMPTY_FIXTURES: FixtureItem[] = [];
const EMPTY_POLICIES: PolicyClause[] = [];
const EMPTY_SIDE: SidePanel = {toolRequests: [], retrievedEvidenceIds: [], retrievedPolicyIds: [], advocateCase: null};
const EMPTY_EVIDENCE: Record<Family, EvidenceCard[]> = {gps: [], chat: [], payment: [], history: []};
const EMPTY_IDS: string[] = [];
const FAMILIES: Family[] = ['gps', 'chat', 'payment', 'history'];

export function App() {
  const fixtures = useFixtures();
  const {state, start, keepWaiting, stop} = useRunPolling();
  const [selectedId, setSelectedId] = useState('');
  const [claim, setClaim] = useState('');
  const [claimEdited, setClaimEdited] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fixtureList = fixtures.data === null ? EMPTY_FIXTURES : fixtures.data.fixtures;
  const busy = state.phase === 'starting' || state.phase === 'polling';
  const vm = useMemo(
    () => (state.run === null ? null : buildViewModel(state.run, state.events)),
    [state.run, state.events]
  );
  const page = pageState(state.phase, vm === null ? null : vm.status);

  const evidenceLabels = useMemo(() => {
    const map = new Map<string, string>();
    if (vm !== null) {
      for (const family of FAMILIES) for (const card of vm.evidence[family]) map.set(card.id, evidenceLabel(card));
    }
    return map;
  }, [vm]);

  const chipContext = useMemo<ChipContextValue>(() => ({
    knownIds: vm === null ? new Set<string>() : vm.knownIds,
    evidenceLabels,
  }), [vm, evidenceLabels]);

  const citedIds = useMemo(() => {
    if (vm === null || vm.result === null) return EMPTY_IDS;
    const ids: string[] = [];
    for (const finding of vm.result.findings) {
      for (const id of finding.policyClauseIds) if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [vm]);

  // Default to the first fixture once the list loads.
  useEffect(() => {
    if (selectedId !== '' || fixtureList.length === 0) return;
    const first = fixtureList[0];
    if (first === undefined) return;
    setSelectedId(first.id);
    setClaim(first.riderClaim ?? '');
    setClaimEdited(false);
  }, [fixtureList, selectedId]);

  // Elapsed clock: ticks once per second while a run is active.
  useEffect(() => {
    if (!busy) return;
    const interval = window.setInterval(() => { setNow(Date.now()); }, 1000);
    return () => { window.clearInterval(interval); };
  }, [busy]);
  const elapsedSeconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));

  const handleSelect = (id: string): void => {
    setSelectedId(id);
    const fixture = fixtureList.find(item => item.id === id);
    setClaim(fixture === undefined ? '' : fixture.riderClaim ?? '');
    setClaimEdited(false);
  };
  const handleClaimChange = (value: string): void => {
    setClaim(value);
    setClaimEdited(true);
  };
  const handleResolve = (): void => {
    if (busy || selectedId === '') return;
    setStartedAt(Date.now());
    setNow(Date.now());
    void start(selectedId, claimEdited && claim.trim() !== '' ? claim : undefined);
  };
  const handleExport = (): void => {
    const run = state.run;
    if (run === null) return;
    const apiMode = fixtures.data === null ? run.mode : fixtures.data.mode;
    downloadJson(exportFileName(run.fixtureId, run.id), buildExport(run, state.events, apiMode));
  };

  return (
    <ChipContext.Provider value={chipContext}>
      <Header mode={fixtures.data === null ? '' : fixtures.data.mode} />
      <main className="app">
        {fixtures.error === null ? null : <p className="app-error">Could not load fixtures: {fixtures.error}</p>}
        <CaseBar
          fixtures={fixtureList}
          selectedId={selectedId}
          onSelect={handleSelect}
          claim={claim}
          onClaimChange={handleClaimChange}
          busy={busy}
          onResolve={handleResolve}
        />
        <Bench
          page={page}
          phase={state.phase}
          vm={vm}
          problem={state.problem}
          elapsedSeconds={elapsedSeconds}
          events={state.events}
          onRunAgain={handleResolve}
          onKeepWaiting={keepWaiting}
          onStop={stop}
          onExport={handleExport}
        />
        {page === 'idle' ? (
          <HearingLines events={state.events} status={vm === null ? null : vm.status} />
        ) : (
          <>
            <HearingLines events={state.events} status={vm === null ? null : vm.status} />
            <div className="hearing">
              <AdvocatePanel actor="rider" side={vm === null ? EMPTY_SIDE : vm.rider} status={vm === null ? null : vm.status} />
              <JudgePanel result={vm === null ? null : vm.result} status={vm === null ? 'queued' : vm.status} />
              <AdvocatePanel actor="driver" side={vm === null ? EMPTY_SIDE : vm.driver} status={vm === null ? null : vm.status} />
            </div>
            <EvidencePanel evidence={vm === null ? EMPTY_EVIDENCE : vm.evidence} status={vm === null ? null : vm.status} />
            <PolicyPanel policies={vm === null ? EMPTY_POLICIES : vm.policies} citedIds={citedIds} />
          </>
        )}
      </main>
    </ChipContext.Provider>
  );
}
