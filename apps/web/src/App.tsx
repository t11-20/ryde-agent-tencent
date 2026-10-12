import { useEffect, useState } from 'react';
import type { PolicyClause } from '@fairtrip/contracts';
import { ActionCard } from './components/ActionCard.js';
import { AdvocatePanel } from './components/AdvocatePanel.js';
import { DisputePanel } from './components/DisputePanel.js';
import { EvidencePanel } from './components/EvidencePanel.js';
import { Header } from './components/Header.js';
import { JudgePanel } from './components/JudgePanel.js';
import { PolicyPanel } from './components/PolicyPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { Timeline } from './components/Timeline.js';
import { useFixtures } from './hooks/useFixtures.js';
import { useRunPolling } from './hooks/useRunPolling.js';
import type { FixtureItem } from './lib/api.js';
import { buildExport, downloadJson, exportFileName } from './lib/export.js';
import { buildViewModel } from './lib/view-model.js';
import type { EvidenceCard, Family, SidePanel } from './lib/view-model.js';

const EMPTY_FIXTURES: FixtureItem[] = [];
const EMPTY_POLICIES: PolicyClause[] = [];
const EMPTY_SIDE: SidePanel = {toolRequests: [], retrievedEvidenceIds: [], retrievedPolicyIds: [], advocateCase: null};
const EMPTY_EVIDENCE: Record<Family, EvidenceCard[]> = {gps: [], chat: [], payment: [], history: []};
const EMPTY_KNOWN = new Set<string>();

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
  const vm = state.run === null ? null : buildViewModel(state.run, state.events);
  const knownIds = vm === null ? EMPTY_KNOWN : vm.knownIds;

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
    <>
      <Header mode={fixtures.data === null ? '' : fixtures.data.mode} />
      <main className="app">
        {fixtures.error === null ? null : <p className="app-error">Could not load fixtures: {fixtures.error}</p>}
        <div className="layout">
          <div className="column column-left">
            <DisputePanel
              fixtures={fixtureList}
              selectedId={selectedId}
              onSelect={handleSelect}
              claim={claim}
              onClaimChange={handleClaimChange}
              busy={busy}
              onResolve={handleResolve}
            />
            <StatusPanel
              phase={state.phase}
              vm={vm}
              problem={state.problem}
              elapsedSeconds={elapsedSeconds}
              onRunAgain={handleResolve}
              onKeepWaiting={keepWaiting}
              onStop={stop}
              onExport={handleExport}
            />
          </div>
          <div className="column column-centre">
            <AdvocatePanel title="Rider Advocate" actor="rider" side={vm === null ? EMPTY_SIDE : vm.rider} knownIds={knownIds} />
            <AdvocatePanel title="Driver Advocate" actor="driver" side={vm === null ? EMPTY_SIDE : vm.driver} knownIds={knownIds} />
            <JudgePanel result={vm === null ? null : vm.result} knownIds={knownIds} status={vm === null ? 'queued' : vm.status} />
            {vm !== null && vm.showAction && vm.result !== null ? <ActionCard result={vm.result} /> : null}
          </div>
          <div className="column column-right">
            <Timeline events={state.events} knownIds={knownIds} />
          </div>
        </div>
        <div className="bottom-row">
          <EvidencePanel evidence={vm === null ? EMPTY_EVIDENCE : vm.evidence} knownIds={knownIds} />
          <PolicyPanel policies={vm === null ? EMPTY_POLICIES : vm.policies} />
        </div>
      </main>
    </>
  );
}
