import type { ActivityEvent } from '@fairtrip/contracts';
import { Chip } from './Chip.js';
import { actorLabel, eventLabel } from '../lib/format.js';
import { elapsedSeconds } from '../lib/events.js';

interface TimelineProps { events: ActivityEvent[] }

export function Timeline({events}: TimelineProps) {
  if (events.length === 0) {
    return <p className="placeholder">No activity yet. Select Resolve dispute to start a run.</p>;
  }
  return (
    <ol className="timeline-list">
      {events.map(event => {
        const handoff = event.type === 'judge.started';
        return (
          <li
            key={event.sequence}
            className={`timeline-item timeline-actor-${event.actor}${handoff ? ' timeline-handoff' : ''}`}
          >
            <span className="timeline-dot" aria-hidden="true" />
            <div className="timeline-body">
              <p className="timeline-meta">
                <span className="timeline-actor">{actorLabel(event.actor)}</span>
                <span>{eventLabel(event.type)}</span>
                <span className="timeline-elapsed">+{elapsedSeconds(events, event)} s</span>
              </p>
              <p className="timeline-summary">{event.summary}</p>
              {handoff ? <p className="timeline-handoff-note">Both cases handed to the Judge</p> : null}
              {event.evidenceIds.length === 0 && event.policyClauseIds.length === 0 ? null : (
                <div className="chip-row">
                  {event.evidenceIds.map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" />)}
                  {event.policyClauseIds.map((id, index) => <Chip key={`pol-${id}-${index}`} id={id} kind="policy" />)}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
