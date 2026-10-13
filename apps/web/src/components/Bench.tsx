import type { ActivityEvent } from '@fairtrip/contracts';
import type { PollPhase } from '../hooks/useRunPolling.js';
import { percent, rulingLabel } from '../lib/format.js';
import {
  actionHeadline, describeError, firstSentence, formatSeconds,
  STAGES, stageOf, stoppedAfterSeconds,
} from '../lib/present.js';
import type { PageState } from '../lib/present.js';
import type { ViewModel } from '../lib/view-model.js';

interface BenchProps {
  page: PageState;
  phase: PollPhase;
  vm: ViewModel | null;
  problem: string | null;
  elapsedSeconds: number;
  events: ActivityEvent[];
  onRunAgain: () => void;
  onKeepWaiting: () => void;
  onStop: () => void;
  onExport: () => void;
}

function StageTracker({current}: {current: number}) {
  return (
    <ol className="stage-list">
      {STAGES.map((stage, index) => (
        <li
          key={stage}
          className={index === current ? 'stage stage-current' : index < current ? 'stage stage-past' : 'stage stage-future'}
          aria-current={index === current ? 'step' : undefined}
        >
          {stage}
        </li>
      ))}
    </ol>
  );
}

export function Bench({page, phase, vm, problem, elapsedSeconds, events, onRunAgain, onKeepWaiting, onStop, onExport}: BenchProps) {
  const tint =
    page === 'completed' && vm !== null && vm.result !== null
      ? (vm.result.ruling === 'rider_favored' ? 'bench-rider' : vm.result.ruling === 'driver_favored' ? 'bench-driver' : 'bench-judge')
      : page === 'incomplete' ? 'bench-amber'
      : page === 'failed' || page === 'contract_mismatch' || page === 'connection_lost' ? 'bench-warn'
      : 'bench-plain';

  const exportButton = vm === null ? null : (
    <button type="button" className="btn-secondary" onClick={onExport}>Export case file</button>
  );
  const showStop = phase === 'polling' || (phase === 'done' && vm !== null && (vm.status === 'queued' || vm.status === 'running'));

  const failedInfo = page === 'failed'
    ? (phase === 'start_failed'
        ? describeError('START_FAILED', problem ?? 'Unknown error')
        : describeError(vm === null || vm.error === null ? 'UNKNOWN' : vm.error.code, vm === null || vm.error === null ? 'Unknown error' : vm.error.message))
    : null;
  const stoppedAfter = stoppedAfterSeconds(events);

  return (
    <section className={`panel bench ${tint}`} aria-labelledby="bench-heading" aria-live="polite">
      {page === 'idle' ? (
        <>
          <h2 id="bench-heading" className="bench-heading-idle">Pick a case and resolve it. Both advocates gather evidence in parallel, then the Judge rules.</h2>
          <ol className="bench-steps">
            <li>Pick a case; edit the rider claim if you like.</li>
            <li>Select Resolve dispute. The Rider Advocate and Driver Advocate each gather evidence on their own.</li>
            <li>The Judge rules on both cases, and the server calculates any amount.</li>
          </ol>
        </>
      ) : null}

      {page === 'running' ? (
        <>
          <div className="bench-run-head">
            <h2 id="bench-heading" className="bench-heading">Hearing in progress</h2>
            <p className={`bench-elapsed${elapsedSeconds >= 75 ? ' bench-elapsed-warn' : ''}`} role="timer" aria-live="off">
              {elapsedSeconds} s of 90 s
            </p>
          </div>
          <StageTracker current={phase === 'starting' ? 0 : stageOf(events)} />
          <div className="bench-actions">
            {showStop ? <button type="button" className="btn-secondary" onClick={onStop}>Stop</button> : null}
            {exportButton}
          </div>
        </>
      ) : null}

      {page === 'completed' && vm !== null && vm.result !== null ? (
        <div className="bench-verdict">
          <div className="bench-verdict-left">
            <h2 id="bench-heading" className="bench-ruling">{rulingLabel(vm.result.ruling)}</h2>
            <p className="bench-reason">{firstSentence(vm.result.reasoning)}</p>
          </div>
          <div className="bench-verdict-right">
            <p className="bench-action">{actionHeadline(vm.result.action)}</p>
            <p className="bench-note">Amount calculated by the server from the evidence, not by the model.</p>
            <div className="bench-confidence">
              <p className="bench-confidence-label">Model-assessed confidence {percent(vm.result.confidence)}</p>
              <div className="confidence-bar" role="img" aria-label={`Model-assessed confidence ${percent(vm.result.confidence)}`}>
                <div className="confidence-fill" style={{width: percent(vm.result.confidence)}} />
              </div>
            </div>
            <div className="bench-actions">{exportButton}</div>
          </div>
        </div>
      ) : null}

      {page === 'incomplete' && vm !== null ? (
        <>
          <h2 id="bench-heading" className="bench-ruling">No ruling: decisive evidence is missing</h2>
          {vm.missingEvidence.length === 0 ? null : (
            <ul className="bench-missing">{vm.missingEvidence.map(item => <li key={item}>{item}</li>)}</ul>
          )}
          <p>This case needs human review.</p>
          <div className="bench-actions">
            <button type="button" className="btn-primary" onClick={onRunAgain}>Try again</button>
            {exportButton}
          </div>
        </>
      ) : null}

      {page === 'failed' && failedInfo !== null ? (
        <>
          <h2 id="bench-heading" className="bench-heading">{failedInfo.title}</h2>
          <p>{failedInfo.sentence}</p>
          {stoppedAfter === null ? null : <p className="bench-meta">{`Stopped after ${formatSeconds(stoppedAfter)} s`}</p>}
          <div className="bench-actions">
            {failedInfo.retry ? <button type="button" className="btn-primary" onClick={onRunAgain}>Try again</button> : null}
            {exportButton}
          </div>
          <details className="tech-details">
            <summary>Technical details</summary>
            <pre>{`${phase === 'start_failed' ? 'START_FAILED' : vm === null || vm.error === null ? 'UNKNOWN' : vm.error.code}: ${phase === 'start_failed' ? (problem ?? 'Unknown error') : vm === null || vm.error === null ? 'Unknown error' : vm.error.message}`}</pre>
          </details>
        </>
      ) : null}

      {page === 'stopped' ? (
        <>
          <h2 id="bench-heading" className="bench-heading">Polling stopped</h2>
          <p>The run is no longer being watched. Select Resolve dispute to start a new run.</p>
          <div className="bench-actions">{exportButton}</div>
        </>
      ) : null}

      {page === 'contract_mismatch' ? (
        <>
          <h2 id="bench-heading" className="bench-heading">Contract mismatch</h2>
          <p className="bench-problem">{problem ?? 'Unknown contract mismatch'}</p>
          <div className="bench-actions">{exportButton}</div>
        </>
      ) : null}

      {page === 'connection_lost' ? (
        <>
          <h2 id="bench-heading" className="bench-heading">Connection lost</h2>
          <p className="bench-problem">{problem ?? 'The API could not be reached'}</p>
          <div className="bench-actions">
            <button type="button" className="btn-secondary" onClick={onKeepWaiting}>Keep waiting</button>
            <button type="button" className="btn-secondary" onClick={onStop}>Stop</button>
            {exportButton}
          </div>
        </>
      ) : null}
    </section>
  );
}
