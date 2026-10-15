import type { ActivityEvent, JudgeResult, Run } from '@fairtrip/contracts';
import type { PollPhase } from '../hooks/useRunPolling.js';

export interface HearingProgressInput {
  events: ActivityEvent[];
  status: Run['status'] | null;
  result?: JudgeResult | null;
  replayProgress?: number;
  progressMode?: 'replay' | 'live';
  phase?: PollPhase;
  reviewPending?: boolean;
}

export interface HearingProgress {
  value: number;
  label: string;
  description: string;
  state: 'idle' | 'running' | 'paused' | 'complete' | 'attention';
}

function boundedPercent(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : 0;
}

/** Milestones describe review stages, never time remaining or model confidence. */
function reviewStages(events: ActivityEvent[]): number {
  if (events.length === 0) return 0;
  let value = 5;
  for (const side of ['rider', 'driver'] as const) {
    const submitted = events.some(event => event.actor === side && event.type === 'case.completed');
    if (submitted || events.some(event => event.actor === side && event.type === 'evidence.retrieved')) value += 15;
    if (submitted) value += 20;
  }
  if (events.some(event => event.type === 'judge.started')) value += 15;
  return value;
}

/** Playback uses actual revealed events; live hearings use observed milestones. */
export function hearingProgress({events, status, result = null, replayProgress, progressMode = 'live', phase, reviewPending = false}: HearingProgressInput): HearingProgress {
  const replay = progressMode === 'replay';
  const terminal = status === 'completed' || status === 'incomplete' || status === 'failed';
  const complete = status === 'completed' && result !== null && result.ruling !== 'incomplete' && !reviewPending;
  const incomplete = status === 'incomplete' || (status === 'completed' && result?.ruling === 'incomplete');
  const label = replay ? 'Case review progress' : 'Review stages';
  const rawValue = replay && replayProgress !== undefined ? boundedPercent(replayProgress) : reviewStages(events);
  // A recording can finish without a decision. Its 100% describes playback only.
  const value = replay ? Math.min(terminal ? 100 : 99, rawValue) : complete ? 100 : Math.min(90, rawValue);

  if (reviewPending) return {value, label, state: 'attention', description: replay ? 'Case review finished · Human review needed' : 'Human review needed · No final decision'};
  if (incomplete) return {value, label, state: 'attention', description: replay ? 'Case review finished · More information needed' : 'More information needed · Review could not finish'};
  if (status === 'failed') return {value, label, state: 'attention', description: replay ? 'Case review finished · Hearing interrupted' : 'Hearing interrupted · No final decision'};
  if (status === 'completed' && !complete) return {value, label, state: 'attention', description: 'Decision unavailable'};
  if (complete) return {value, label, state: 'complete', description: replay ? 'Case review finished · Decision ready' : 'Review complete · Decision ready'};
  if (phase === 'stopped') return {value, label, state: 'paused', description: replay ? 'Case review paused · Continue when ready' : 'Updates paused · Last known progress'};
  if (phase === 'connection_lost') return {value, label, state: 'attention', description: 'Connection lost · Progress saved'};
  if (phase === 'start_failed' || phase === 'contract_mismatch') return {value, label, state: 'attention', description: 'Review unavailable · Please try again'};
  if (events.length === 0 && status === null && phase !== 'starting' && phase !== 'polling') return {value: 0, label, state: 'idle', description: replay ? 'Ready to view the case review' : 'Choose a case to begin'};
  return {value, label, state: 'running', description: replay ? 'Viewing the saved case review' : 'Based on reached stages · Time remaining may vary'};
}
