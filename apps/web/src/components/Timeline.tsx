import { KNOWN_ACTORS, type ActivityEvent } from "../contracts/provisional";
import { Chips } from "./citations";

const ACTOR_LABEL: Record<string, string> = {
  controller: "controller", rider_advocate: "rider", driver_advocate: "driver", judge: "judge", validator: "validator",
};

export function Timeline({ events }: { events: readonly ActivityEvent[] }) {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
  const t0 = sorted[0] ? Date.parse(sorted[0].timestamp) : NaN;
  return (
    <section className="panel timeline" aria-label="Timeline">
      <h2>Timeline</h2>
      {sorted.length === 0 ? <p className="muted">No events yet.</p> : (
        <ol>
          {sorted.map((e) => {
            const known = (KNOWN_ACTORS as readonly string[]).includes(e.actor);
            const elapsed = Number.isFinite(t0) && Number.isFinite(Date.parse(e.timestamp)) ? Math.round((Date.parse(e.timestamp) - t0) / 1000) : null;
            return (
              <li key={e.sequence} className={`event event-${e.type}${e.type === "handoff_to_judge" ? " event-handoff" : ""}${e.dev ? " event-dev" : ""}`} data-type={e.type}>
                <span className="mono seq">#{e.sequence}</span>
                <span className={`badge ${known ? `actor-${e.actor}` : "actor-other"}`}>{ACTOR_LABEL[e.actor] ?? e.actor}</span>
                <span className="mono type">{e.type}</span>
                <span className="mono elapsed">{elapsed === null ? "—" : `+${elapsed}s`}</span>
                {e.dev && <span className="badge dev">DEV MOCK</span>}
                <span className="summary">{e.summary}</span>
                <Chips evidenceIds={e.refs?.evidenceIds} policyIds={e.refs?.policyIds} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
