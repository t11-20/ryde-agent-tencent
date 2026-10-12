import type { ActivityEvent } from '@fairtrip/contracts';
import { Chip } from './Chip.js';
import { actorLabel, eventLabel } from '../lib/format.js';
import { elapsedSeconds } from '../lib/events.js';

interface TimelineProps {
  events: ActivityEvent[];
  knownIds: Set<string>;
}

export function Timeline({events, knownIds}: TimelineProps) {
  return (
    <section className="panel timeline" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="panel-title">Agent activity</h2>
      {events.length === 0 ? (
        <p className="placeholder">No activity yet. Select Resolve dispute to start a run.</p>
      ) : (
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
                      {event.evidenceIds.map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" known={knownIds.has(id)} />)}
                      {event.policyClauseIds.map((id, index) => <Chip key={`pol-${id}-${index}`} id={id} kind="policy" known={knownIds.has(id)} />)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
