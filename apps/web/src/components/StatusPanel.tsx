import type { ReactNode } from 'react';
import type { Run } from '@fairtrip/contracts';
import type { PollPhase } from '../hooks/useRunPolling.js';
import { rulingLabel } from '../lib/format.js';
import type { ViewModel } from '../lib/view-model.js';

interface StatusPanelProps {
  phase: PollPhase;
  vm: ViewModel | null;
  problem: string | null;
  elapsedSeconds: number;
  onRunAgain: () => void;
  onKeepWaiting: () => void;
  onStop: () => void;
  onExport: () => void;
}

interface StatusView { headline: string; headlineClass: string; detail: ReactNode; showElapsed: boolean; showStop: boolean; runAgain: boolean; keepWaiting: boolean }

function statusView(phase: PollPhase, vm: ViewModel | null, problem: string | null): StatusView {
  if (phase === 'idle') return {headline: 'No run yet', headlineClass: '', detail: <p>Pick a fixture and select Resolve dispute.</p>, showElapsed: false, showStop: false, runAgain: false, keepWaiting: false};
  if (phase === 'starting') return {headline: 'Starting the run', headlineClass: '', detail: <p>Waiting for the API to accept the run.</p>, showElapsed: true, showStop: false, runAgain: false, keepWaiting: false};
  if (phase === 'polling') return {headline: 'Run in progress', headlineClass: '', detail: null, showElapsed: true, showStop: true, runAgain: false, keepWaiting: false};
  if (phase === 'stopped') return {headline: 'Polling stopped', headlineClass: '', detail: <p>The run is no longer being watched. Select Resolve dispute to start a new run.</p>, showElapsed: false, showStop: false, runAgain: false, keepWaiting: false};
  if (phase === 'start_failed') return {headline: 'Could not start the run', headlineClass: 'status-headline-failed', detail: <p className="status-problem">{problem ?? 'Unknown error'}</p>, showElapsed: false, showStop: false, runAgain: true, keepWaiting: false};
  if (phase === 'contract_mismatch') return {headline: 'Contract mismatch', headlineClass: 'status-headline-failed', detail: <p className="status-problem">{problem ?? 'Unknown contract mismatch'}</p>, showElapsed: false, showStop: false, runAgain: false, keepWaiting: false};
  if (phase === 'connection_lost') return {headline: 'Connection lost', headlineClass: 'status-headline-failed', detail: <p className="status-problem">{problem ?? 'The API could not be reached'}</p>, showElapsed: false, showStop: false, runAgain: false, keepWaiting: true};
  // phase === 'done'
  const status: Run['status'] | null = vm?.status ?? null;
  if (status === 'completed') {
    const ruling = vm !== null && vm.result !== null ? rulingLabel(vm.result.ruling) : '';
    return {headline: 'Run completed', headlineClass: '', detail: <p>Ruling: {ruling}</p>, showElapsed: false, showStop: false, runAgain: false, keepWaiting: false};
  }
  if (status === 'incomplete') {
    const missing = vm?.missingEvidence ?? [];
    return {
      headline: 'Incomplete — human review needed', headlineClass: 'status-headline-incomplete',
      detail: (
        <div className="status-detail">
          <p>No ruling or payment was issued; this case needs human review.</p>
          {missing.length === 0 ? null : (
            <div>
              <p className="field-label">Missing evidence</p>
              <ul className="missing-list">{missing.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
        </div>
      ),
      showElapsed: false, showStop: false, runAgain: true, keepWaiting: false
    };
  }
  if (status === 'failed') {
    const error = vm?.error ?? null;
    return {
      headline: 'Run failed', headlineClass: 'status-headline-failed',
      detail: <p className="status-problem">{error === null ? 'Unknown error' : `Error ${error.code}: ${error.message}`}</p>,
      showElapsed: false, showStop: false, runAgain: true, keepWaiting: false
    };
  }
  return {headline: 'Run in progress', headlineClass: '', detail: <p>Waiting for the run to finish.</p>, showElapsed: true, showStop: true, runAgain: false, keepWaiting: false};
}

export function StatusPanel({phase, vm, problem, elapsedSeconds, onRunAgain, onKeepWaiting, onStop, onExport}: StatusPanelProps) {
  const view = statusView(phase, vm, problem);
  const deadlineNear = elapsedSeconds >= 75;
  return (
    <section className="panel panel-system" aria-labelledby="status-heading">
      <h2 id="status-heading" className="panel-title">Status</h2>
      <p className={`status-headline ${view.headlineClass}`}>{view.headline}</p>
      {view.detail === null ? null : <div className="status-detail">{view.detail}</div>}
      {view.showElapsed ? (
        <p className={deadlineNear ? 'status-elapsed status-elapsed-deadline' : 'status-elapsed'}>{elapsedSeconds} s of 90 s</p>
      ) : null}
      <div className="status-actions">
        {view.runAgain ? <button type="button" className="status-button" onClick={onRunAgain}>Run again</button> : null}
        {view.keepWaiting ? <button type="button" className="status-button" onClick={onKeepWaiting}>Keep waiting</button> : null}
        {view.showStop || view.keepWaiting ? <button type="button" className="status-button status-button-secondary" onClick={onStop}>Stop</button> : null}
        <button type="button" className="status-button status-button-secondary" onClick={onExport} disabled={vm === null}>Export case file</button>
      </div>
    </section>
  );
}
