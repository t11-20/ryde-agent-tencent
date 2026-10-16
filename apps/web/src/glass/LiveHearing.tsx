import { useCallback, useEffect, useState } from 'react';
import type { FinalAction } from '@fairtrip/contracts';
import { useFixtures } from '../hooks/useFixtures.js';
import { useRunPolling } from '../hooks/useRunPolling.js';
import { listRuns, postReview } from '../lib/api.js';
import type { RunListItem } from '../lib/api.js';
import { runDeepLink, runIdFromLocation } from '../lib/deep-link.js';
import { retryNote } from '../lib/present.js';
import { CaseSegment, HearingBoard } from './HearingPresentation.js';

export function LiveHearing() {
  const fixtures = useFixtures();
  const {state, start, resume, stop, keepWaiting, replaceRun} = useRunPolling();
  const [selectedId, setSelectedId] = useState('');
  const [claim, setClaim] = useState('');
  const [edited, setEdited] = useState(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const [submittedCase, setSubmittedCase] = useState<{id: string; revision: number} | null>(null);
  const [resumedRunId, setResumedRunId] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunListItem[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const options = fixtures.data?.fixtures ?? [];
  const selected = options.find(option => option.id === selectedId);
  const matchesSubmittedCase = submittedCase?.id === selectedId && submittedCase.revision === draftRevision;
  const shownRun = (matchesSubmittedCase && state.run?.fixtureId === selectedId) || (resumedRunId !== null && state.run?.id === resumedRunId) ? state.run : null;
  const shownEvents = shownRun === null ? [] : state.events;
  const shownPhase = shownRun === null ? 'idle' : state.phase;
  const busy = state.phase === 'starting' || state.phase === 'polling';
  const reviewPending = shownRun?.status === 'completed' && shownRun.escalation !== undefined && shownRun.review === undefined;
  useEffect(() => {
    const first = fixtures.data?.fixtures[0];
    if (selectedId !== '' || first === undefined) return;
    setSelectedId(first.id); setClaim(first.riderClaim ?? ''); setEdited(false);
  }, [fixtures.data, selectedId]);
  // A resumed run selects its own fixture once it arrives.
  useEffect(() => {
    const fixtureId = state.run?.id === resumedRunId ? state.run.fixtureId : null;
    if (fixtureId !== null && fixtureId !== selectedId && options.some(option => option.id === fixtureId)) {
      setSelectedId(fixtureId); setClaim(options.find(option => option.id === fixtureId)?.riderClaim ?? ''); setEdited(false);
    }
  }, [state.run, resumedRunId, selectedId, options]);
  const choose = (id: string) => {
    if (state.phase === 'connection_lost') stop();
    setSelectedId(id); setClaim(options.find(option => option.id === id)?.riderClaim ?? ''); setEdited(false);
    setDraftRevision(value => value + 1); setResumedRunId(null);
  };
  const resolve = () => {
    if (busy || reviewBusy || selectedId === '' || (edited && claim.trim() === '')) return;
    setSubmittedCase({id: selectedId, revision: draftRevision});
    setReviewError(null);
    void start(selectedId, edited && claim.trim() !== '' ? claim : undefined);
  };
  // Recent runs + shared ?run=<id> links resume an existing run and keep the URL in sync.
  // Deps must stay stable — a callback that changes with state.phase would re-run the
  // deep-link effect and resume the run in a loop.
  const openRun = useCallback((id: string) => {
    void resume(id).then(ok => {
      window.history.replaceState(null, '', ok ? runDeepLink(id) : window.location.pathname);
      if (ok) setResumedRunId(id);
    });
  }, [resume]);
  useEffect(() => {
    const id = runIdFromLocation(window.location.search);
    if (id !== null) openRun(id);
  }, [openRun]);
  useEffect(() => {
    if (shownRun !== null && runIdFromLocation(window.location.search) !== shownRun.id)
      window.history.replaceState(null, '', runDeepLink(shownRun.id));
  }, [shownRun]);
  const refreshRuns = useCallback(() => {
    void listRuns().then(setRecentRuns).catch(() => undefined);
  }, []);
  useEffect(refreshRuns, [refreshRuns]);
  useEffect(() => { if (state.phase === 'done') refreshRuns(); }, [state.phase, refreshRuns]);
  const submitReview = (body: {decision: 'confirmed'} | {decision: 'overridden'; remedyId: FinalAction['remedyId']; note?: string}): void => {
    const run = shownRun;
    if (run === null || reviewBusy) return;
    setReviewBusy(true); setReviewError(null);
    void postReview(run.id, body).then(replaceRun).catch((error: unknown) => {
      setReviewError(error instanceof Error ? error.message : String(error));
    }).finally(() => { setReviewBusy(false); });
  };
  const review = shownRun === null ? undefined : {
    busy: reviewBusy,
    error: reviewError,
    onConfirm: () => { submitReview({decision: 'confirmed'}); },
    onOverride: (remedyId: FinalAction['remedyId'], note: string) => {
      submitReview(note === '' ? {decision: 'overridden', remedyId} : {decision: 'overridden', remedyId, note});
    },
  };
  const connectedReplay = fixtures.data?.mode === 'replay';
  const mode = fixtures.data?.mode === 'live' ? 'Live hearing' : fixtures.data?.mode === 'stub' ? 'Example hearing' : connectedReplay ? 'Recorded case review' : 'Available cases';
  // In replay mode the run itself carries when the live hearing was recorded.
  const sourceLabel = connectedReplay && shownRun !== null && shownRun.replay !== undefined
    ? `Replay of live run · recorded ${shownRun.replay.recordedAt.slice(0, 10)} · Synthetic data`
    : `${mode} · Synthetic data`;
  return <HearingBoard run={shownRun} events={shownEvents} phase={shownPhase} problem={(shownRun === null ? null : state.problem) ?? fixtures.error} progressMode="live"
    note={state.retriedFrom === null ? null : retryNote(state.retriedMessage ?? '')}
    footer={recentRuns.length === 0 ? null : (
      <details className="lines-log glass-recent-runs"><summary>Earlier runs on this server</summary>
        <select className="casebar-select" value="" aria-label="Earlier runs" onChange={event => { if (event.target.value !== '') openRun(event.target.value); }}>
          <option value="">Earlier runs…</option>
          {recentRuns.map(item => (
            <option key={item.id} value={item.id}>{`${item.fixtureId} · ${item.status} · ${item.remedyId ?? '—'}${item.retryOf ? ' (re-run)' : ''}`}</option>
          ))}
        </select>
      </details>
    )}
    {...(review === undefined ? {} : {review})}
    caseContent={<CaseSegment options={options} selectedId={selectedId} onSelect={choose} claim={claim || (!edited ? shownRun?.dispute.riderClaim ?? '' : '')} statement={selected?.driverStatement ?? shownRun?.dispute.driverStatement ?? ''} sourceLabel={sourceLabel} onAction={resolve} actionLabel={busy ? connectedReplay ? 'Viewing case review…' : 'Reviewing your case…' : fixtures.loading ? 'Loading cases…' : connectedReplay ? 'View case review' : 'Review my case'} busy={busy} actionBusy={busy || fixtures.loading || reviewBusy} actionStatus={state.phase === 'starting' ? 'Preparing your case review' : busy ? connectedReplay ? 'Viewing the recorded case review' : 'The four agents are reviewing your case' : reviewPending ? 'Waiting for a human reviewer' : fixtures.loading ? 'Loading available cases' : ''} actionDisabled={(edited && claim.trim() === '') || reviewBusy} {...(connectedReplay ? {} : {onClaimChange: (value: string) => { if (state.phase === 'connection_lost') stop(); setClaim(value); setEdited(true); setDraftRevision(revision => revision + 1); }})} />}
    controls={<>{fixtures.error === null ? null : <ul className="glass-key-points app-error" role="alert"><li>Cases could not be loaded. Please try again later or explore the recorded cases.</li></ul>}{busy || shownPhase === 'connection_lost' ? <div className="glass-hearing-controls">{shownPhase === 'connection_lost' ? <button type="button" className="btn-secondary" onClick={keepWaiting}>Keep waiting</button> : null}<button type="button" className="btn-secondary" onClick={stop}>Stop watching</button></div> : null}</>} />;
}
