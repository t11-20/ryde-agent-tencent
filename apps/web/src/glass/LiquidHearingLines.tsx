import { useEffect, useId, useMemo, useState } from 'react';
import type { ActivityEvent, AdvocateCase, JudgeResult, Run } from '@fairtrip/contracts';
import { remedyLabel, rulingLabel } from '../lib/format.js';
import { actionHeadline, firstSentence } from '../lib/present.js';
import type { PollPhase } from '../hooks/useRunPolling.js';
import { HearingSymbol } from './HearingSymbol.js';
import { KeyPoints } from './KeyPoints.js';
import { hearingProgress } from './hearing-progress.js';

interface LiquidHearingLinesProps {
  events: ActivityEvent[];
  status: Run['status'] | null;
  result?: JudgeResult | null;
  cases?: AdvocateCase[];
  replayProgress?: number;
  progressMode?: 'replay' | 'live';
  phase?: PollPhase;
  reviewPending?: boolean;
}

const HEARING_LANES = ['rider', 'judge', 'driver'] as const;
type HearingLane = typeof HEARING_LANES[number];
type Stage = 'evidence' | 'case' | 'review' | 'decision';
interface DecisionPoint {
  event: ActivityEvent;
  lane: HearingLane;
  stage: Stage;
  label: string;
}

const MIN_WIDTH = 780;
const LABEL_WIDTH = 190;
const RIGHT_PADDING = 76;
const HEIGHT = 256;
const LANE_Y: Record<HearingLane, number> = {rider: 70, judge: 140, driver: 210};
const LANE_LABEL: Record<HearingLane, string> = {rider: 'Rider Advocate', judge: 'Judge', driver: 'Driver Advocate'};
const STAGES: {id: Stage; label: string; x: number}[] = [
  {id: 'evidence', label: 'Evidence reviewed', x: 0},
  {id: 'case', label: 'Case ready', x: 31},
  {id: 'review', label: 'Judge review', x: 65},
  {id: 'decision', label: 'Decision', x: 100},
];
const STAGE_X: Record<Stage, number> = {evidence: 0, case: 31, review: 65, decision: 100};

function useCanvasWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(960);
  useEffect(() => {
    if (element === null) return;
    const update = () => { setWidth(Math.max(MIN_WIDTH, element.clientWidth)); };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, [element]);
  return [setElement, width];
}

/** Show milestones from recorded events, without exposing the internal event log. */
function hearingPoints(events: ActivityEvent[], result: JudgeResult | null, reviewPending: boolean): DecisionPoint[] {
  const points: DecisionPoint[] = [];
  for (const lane of ['rider', 'driver'] as const) {
    const evidence = events.filter(event => event.actor === lane && event.type === 'evidence.retrieved').at(-1);
    const completed = events.find(event => event.actor === lane && event.type === 'case.completed');
    if (evidence !== undefined) points.push({event: evidence, lane, stage: 'evidence', label: 'Evidence reviewed'});
    if (completed !== undefined) points.push({event: completed, lane, stage: 'case', label: 'Case ready'});
  }
  const review = events.find(event => event.type === 'judge.started');
  if (review !== undefined) points.push({event: review, lane: 'judge', stage: 'review', label: 'Judge review'});
  const decision = events.find(event => event.type === 'run.completed' || event.type === 'run.incomplete' || event.type === 'run.failed');
  if (decision !== undefined) {
    const finalDecision = decision.type === 'run.completed' && result !== null && result.ruling !== 'incomplete' && !reviewPending;
    const needsInformation = decision.type === 'run.incomplete' || (decision.type === 'run.completed' && result?.ruling === 'incomplete');
    points.push({
      event: decision, lane: 'judge', stage: 'decision',
      label: reviewPending ? 'Human review' : finalDecision ? 'Decision ready' : needsInformation ? 'Needs more information' : decision.type === 'run.failed' ? 'Hearing interrupted' : 'Decision unavailable',
    });
  }
  return points.sort((a, b) => a.event.sequence - b.event.sequence);
}

function checkpointSummary(point: DecisionPoint, cases: AdvocateCase[], result: JudgeResult | null, reviewPending: boolean): string[] {
  if (point.stage === 'evidence') return [`Trip evidence collected for the ${point.lane === 'rider' ? 'rider' : 'driver'} case.`];
  if (point.stage === 'case') {
    const advocateCase = cases.find(item => item.side === point.lane);
    return advocateCase === undefined
      ? ['The case has been submitted to the judge.']
      : [firstSentence(advocateCase.summary), advocateCase.requestedRemedyId === undefined ? 'No remedy requested' : `Requested: ${remedyLabel(advocateCase.requestedRemedyId)}`];
  }
  if (point.stage === 'review') return ['The judge has started reviewing the submitted cases.', 'The review considers each case and its supporting evidence.'];
  if (point.event.type === 'run.completed' && result !== null && result.ruling !== 'incomplete') {
    if (reviewPending) return ['The Judge has made a recommendation.', `Proposed: ${actionHeadline(result.action)}`, 'A human reviewer must decide before any payment.'];
    return [rulingLabel(result.ruling), actionHeadline(result.action), firstSentence(result.reasoning)];
  }
  if (point.event.type === 'run.incomplete' || (point.event.type === 'run.completed' && result?.ruling === 'incomplete')) return ['More information is needed.', 'No final decision has been reached.'];
  if (point.event.type === 'run.failed') return ['The hearing could not finish.', 'No final decision is available.'];
  return ['A final decision is not available for this hearing.'];
}

/** Preview-only, interactive milestones. Every completed point comes from the run. */
export function LiquidHearingLines({events, status, result = null, cases = [], replayProgress, progressMode = 'live', phase, reviewPending = false}: LiquidHearingLinesProps) {
  const id = useId();
  const [canvasRef, width] = useCanvasWidth();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const runId = events[0]?.runId;
  useEffect(() => { setHovered(null); setFocused(null); setPinned(null); }, [runId]);

  const points = useMemo(() => hearingPoints(events, result, reviewPending), [events, result, reviewPending]);
  const plotWidth = Math.max(0, width - LABEL_WIDTH - RIGHT_PADDING);
  const px = (x: number) => LABEL_WIDTH + (x / 100) * plotWidth;
  const activeSequence = hovered ?? focused ?? pinned;
  const active = points.find(point => point.event.sequence === activeSequence) ?? null;
  const reviewStarted = points.some(point => point.stage === 'review');
  const decisionReached = points.some(point => point.stage === 'decision');
  const waiting = status === null || status === 'queued' || status === 'running';
  const finalDecision = status === 'completed' && result !== null && result.ruling !== 'incomplete' && !reviewPending;
  const needsInformation = status === 'incomplete' || (status === 'completed' && result?.ruling === 'incomplete');
  const progress = hearingProgress({events, status, result, replayProgress, progressMode, phase, reviewPending});

  const completedRoute = (lane: HearingLane) => lane === 'judge'
    ? reviewStarted && decisionReached
    : points.some(point => point.lane === lane && point.stage === 'evidence')
      && points.some(point => point.lane === lane && point.stage === 'case');

  return (
    <section className="panel lines glass-timeline" aria-labelledby={`${id}-heading`}>
      <div className="glass-timeline-heading">
        <h2 id={`${id}-heading`} className="panel-title glass-timeline-title">Hearing lines</h2>
        <span className="glass-timeline-state">{reviewPending ? 'Human review needed' : finalDecision ? 'Decision ready' : needsInformation ? 'More information needed' : status === 'failed' ? 'Hearing interrupted' : status === 'completed' ? 'Decision unavailable' : waiting ? 'Follow the review' : 'Review paused'}</span>
      </div>
      <div className="glass-hearing-progress" data-state={progress.state}>
        <div className="glass-hearing-progress-heading"><strong>{progress.label}</strong><span className="glass-hearing-progress-value">{progress.value}%</span></div>
        <div role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.value} aria-valuetext={`${progress.value}% · ${progress.description}`} aria-describedby={`${id}-progress-description`}>
          <svg className="glass-hearing-progress-bar" viewBox="0 0 1000 12" preserveAspectRatio="none" aria-hidden="true">
            <path className="glass-hearing-progress-track" d="M 6 6 H 994" pathLength={100} />
            <path className="glass-hearing-progress-fill" d="M 6 6 H 994" pathLength={100} strokeDasharray={100} style={{strokeDashoffset: 100 - progress.value, opacity: progress.value > 0 ? 1 : 0}} />
          </svg>
        </div>
        <p id={`${id}-progress-description`} className="glass-hearing-progress-description" role="status">{progress.description}</p>
      </div>
      <ul id={`${id}-help`} className="glass-timeline-help">
        <li>Hover or focus for a summary · Tap to pin · Escape to close</li>
      </ul>
      <div ref={canvasRef} className="glass-timeline-scroll" role="region" aria-label="Three agent tracks, from evidence to decision; scroll horizontally on smaller screens" tabIndex={0}>
        <div className="glass-timeline-canvas" style={{width, height: HEIGHT}}>
          <svg className="glass-timeline-figure" viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} aria-hidden="true">
            {STAGES.map(stage => <text key={stage.id} x={px(stage.x)} y={24} textAnchor="middle" className="glass-timeline-tick glass-timeline-stage" data-reached={points.some(point => point.stage === stage.id)}>{stage.label}</text>)}
            {HEARING_LANES.map(lane => {
              if (!completedRoute(lane)) return null;
              const start = lane === 'judge' ? px(STAGE_X.review) : px(STAGE_X.evidence);
              const end = lane === 'judge' ? px(STAGE_X.decision) : px(STAGE_X.case);
              const route = lane === 'judge' ? 'decision' : 'evidence';
              return (
                <g key={lane} className="glass-timeline-track" data-lane={lane} data-ready="true" data-route={route}>
                  <line pathLength={1} x1={start} y1={LANE_Y[lane] + 3} x2={end} y2={LANE_Y[lane] + 3} className="glass-timeline-rail-shadow glass-timeline-reveal" data-route={route} />
                  <line pathLength={1} x1={start} y1={LANE_Y[lane]} x2={end} y2={LANE_Y[lane]} className="glass-timeline-segment glass-timeline-reveal" data-lane={lane} data-route={route} />
                  <line pathLength={1} x1={start} y1={LANE_Y[lane] - 1} x2={end} y2={LANE_Y[lane] - 1} className="glass-timeline-rail-highlight glass-timeline-reveal" data-route={route} />
                </g>
              );
            })}
            {(['rider', 'driver'] as const).map(lane => {
              const hasCase = cases.some(item => item.side === lane)
                && points.some(point => point.lane === lane && point.stage === 'case');
              return reviewStarted && hasCase ? (
                <path key={lane} pathLength={1} d={`M ${px(STAGE_X.case)} ${LANE_Y[lane]} C ${px(48)} ${LANE_Y[lane]}, ${px(48)} ${LANE_Y.judge}, ${px(STAGE_X.review)} ${LANE_Y.judge}`} className="glass-timeline-connection glass-timeline-reveal" data-lane={lane} data-ready="true" data-route="handoff" />
              ) : null;
            })}
          </svg>
          {HEARING_LANES.map(lane => (
            <div key={lane} className="glass-timeline-lane" data-lane={lane} style={{top: LANE_Y[lane]}}><span className="glass-timeline-lane-symbol" aria-hidden="true"><HearingSymbol name={lane} /></span><span>{LANE_LABEL[lane]}</span></div>
          ))}
          {points.map(point => (
            <button
              key={point.event.sequence}
              type="button"
              className="glass-timeline-point"
              style={{left: px(STAGE_X[point.stage]), top: LANE_Y[point.lane]}}
              data-lane={point.lane}
              data-active={activeSequence === point.event.sequence}
              data-pinned={pinned === point.event.sequence}
              data-terminal={point.stage === 'decision'}
              aria-label={`${LANE_LABEL[point.lane]}: ${point.label}`}
              aria-pressed={pinned === point.event.sequence}
              aria-controls={`${id}-summary`}
              aria-describedby={activeSequence === point.event.sequence ? `${id}-help ${id}-summary` : `${id}-help`}
              onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(point.event.sequence); }}
              onPointerLeave={() => { setHovered(null); }}
              onFocus={() => { setFocused(point.event.sequence); }}
              onBlur={() => { setFocused(null); }}
              onClick={() => { setPinned(value => value === point.event.sequence ? null : point.event.sequence); }}
              onKeyDown={event => { if (event.key === 'Escape') { setHovered(null); setFocused(null); setPinned(null); event.currentTarget.blur(); } }}
            >
              <span className="glass-timeline-orb" aria-hidden="true"><HearingSymbol name={point.stage === 'evidence' ? 'trip' : point.stage === 'case' ? 'case' : point.stage === 'decision' && finalDecision ? 'check' : 'review'} /></span>
              {point.stage === 'decision' && !finalDecision ? <span className="glass-timeline-point-label" aria-hidden="true">{point.label}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div id={`${id}-summary`} className="glass-timeline-summary" data-lane={active?.lane ?? 'judge'} data-open={active !== null} role="region" aria-label="Checkpoint summary">
        {active === null ? (
          <ul className="glass-timeline-keypoints"><li>{events.length === 0 ? 'Checkpoints light up as the hearing progresses.' : 'Select a raised checkpoint for key points.'}</li></ul>
        ) : (
          <>
            <div className="glass-timeline-summary-heading"><strong>{active.label}</strong><span className="glass-timeline-meta">{LANE_LABEL[active.lane]}</span>{pinned === active.event.sequence ? <span className="glass-timeline-pinned">Pinned</span> : null}</div>
            <KeyPoints text={checkpointSummary(active, cases, result, reviewPending)} maxPoints={3} showSource={false} />
          </>
        )}
      </div>
    </section>
  );
}
