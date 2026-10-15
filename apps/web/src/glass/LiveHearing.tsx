import { useEffect, useState } from 'react';
import { useFixtures } from '../hooks/useFixtures.js';
import { useRunPolling } from '../hooks/useRunPolling.js';
import { CaseSegment, HearingBoard } from './HearingPresentation.js';

export function LiveHearing() {
  const fixtures = useFixtures();
  const {state, start, stop, keepWaiting} = useRunPolling();
  const [selectedId, setSelectedId] = useState('');
  const [claim, setClaim] = useState('');
  const [edited, setEdited] = useState(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const [submittedCase, setSubmittedCase] = useState<{id: string; revision: number} | null>(null);
  const options = fixtures.data?.fixtures ?? [];
  const selected = options.find(option => option.id === selectedId);
  const matchesSubmittedCase = submittedCase?.id === selectedId && submittedCase.revision === draftRevision;
  const shownRun = matchesSubmittedCase && state.run?.fixtureId === selectedId ? state.run : null;
  const shownEvents = matchesSubmittedCase ? state.events : [];
  const shownPhase = matchesSubmittedCase ? state.phase : 'idle';
  const busy = state.phase === 'starting' || state.phase === 'polling';
  useEffect(() => {
    const first = fixtures.data?.fixtures[0];
    if (selectedId !== '' || first === undefined) return;
    setSelectedId(first.id); setClaim(first.riderClaim ?? ''); setEdited(false);
  }, [fixtures.data, selectedId]);
  const choose = (id: string) => {
    if (state.phase === 'connection_lost') stop();
    setSelectedId(id); setClaim(options.find(option => option.id === id)?.riderClaim ?? ''); setEdited(false);
    setDraftRevision(value => value + 1);
  };
  const resolve = () => {
    if (busy || selectedId === '' || (edited && claim.trim() === '')) return;
    setSubmittedCase({id: selectedId, revision: draftRevision});
    void start(selectedId, edited && claim.trim() !== '' ? claim : undefined);
  };
  const connectedReplay = fixtures.data?.mode === 'replay';
  const mode = fixtures.data?.mode === 'live' ? 'Live hearing' : fixtures.data?.mode === 'stub' ? 'Example hearing' : connectedReplay ? 'Recorded case review' : 'Available cases';
  return <HearingBoard run={shownRun} events={shownEvents} phase={shownPhase} problem={(matchesSubmittedCase ? state.problem : null) ?? fixtures.error} progressMode="live"
    caseContent={<CaseSegment options={options} selectedId={selectedId} onSelect={choose} claim={claim || (!edited ? shownRun?.dispute.riderClaim ?? '' : '')} statement={selected?.driverStatement ?? shownRun?.dispute.driverStatement ?? ''} sourceLabel={`${mode} · Synthetic data`} onAction={resolve} actionLabel={busy ? connectedReplay ? 'Viewing case review…' : 'Reviewing your case…' : fixtures.loading ? 'Loading cases…' : connectedReplay ? 'View case review' : 'Review my case'} busy={busy} actionBusy={busy || fixtures.loading} actionStatus={state.phase === 'starting' ? 'Preparing your case review' : busy ? connectedReplay ? 'Viewing the recorded case review' : 'The three agents are reviewing your case' : fixtures.loading ? 'Loading available cases' : ''} actionDisabled={edited && claim.trim() === ''} {...(connectedReplay ? {} : {onClaimChange: (value: string) => { if (state.phase === 'connection_lost') stop(); setClaim(value); setEdited(true); setDraftRevision(revision => revision + 1); }})} />}
    controls={<>{fixtures.error === null ? null : <ul className="glass-key-points app-error" role="alert"><li>Cases could not be loaded. Please try again later or explore the recorded cases.</li></ul>}{busy || shownPhase === 'connection_lost' ? <div className="glass-hearing-controls">{shownPhase === 'connection_lost' ? <button type="button" className="btn-secondary" onClick={keepWaiting}>Keep waiting</button> : null}<button type="button" className="btn-secondary" onClick={stop}>Stop watching</button></div> : null}</>} />;
}
