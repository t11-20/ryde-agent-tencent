import type { ActivityEvent, AdvocateCase, CitedPoint } from "../contracts/provisional";
import { Chips } from "./citations";
import { advocateActivity } from "./toolActivity";

function Points({ title, points }: { title: string; points: CitedPoint[] }) {
  return (
    <div className="points">
      <h4>{title}</h4>
      {points.length === 0 ? <p className="muted">None stated.</p> : (
        <ul>
          {points.map((pt, i) => (
            <li key={i}>
              {pt.point} <Chips evidenceIds={pt.evidenceIds} policyIds={pt.policyIds} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdvocatePanel({ side, events, caseData }: { side: "rider" | "driver"; events: readonly ActivityEvent[]; caseData?: AdvocateCase }) {
  const act = advocateActivity(events, `${side}_advocate`);
  const title = side === "rider" ? "Rider Advocate" : "Driver Advocate";
  return (
    <section className={`panel advocate advocate-${side}`} aria-label={title}>
      <h2><span className={`badge actor-${side}_advocate`}>{side}</span> {title}</h2>
      <div className="tool-activity">
        <h4>Tool requests</h4>
        {act.requests.length === 0 ? <p className="muted">No tool requests yet.</p> : (
          <ul className="mono small">{act.requests.map((r, i) => <li key={i}>{r}</li>)}</ul>
        )}
        {(act.retrievedIds.length > 0 || act.retrievedPolicyIds.length > 0) && (
          <div className="retrieved">Retrieved: <Chips evidenceIds={act.retrievedIds} policyIds={act.retrievedPolicyIds} /></div>
        )}
      </div>
      {caseData ? (
        <div className="case">
          <h4>Case summary</h4>
          <p>{caseData.summary}</p>
          <Points title="Arguments" points={caseData.arguments} />
          <Points title="Counterevidence" points={caseData.counterevidence} />
          <div><h4>Requested remedy</h4><span className="mono">{caseData.requestedRemedy}</span></div>
          <div>
            <h4>Missing facts</h4>
            {caseData.missingFacts.length === 0 ? <p className="muted">None stated.</p> : <ul>{caseData.missingFacts.map((m, i) => <li key={i}>{m}</li>)}</ul>}
          </div>
        </div>
      ) : (
        <p className="muted">No case submitted yet.</p>
      )}
    </section>
  );
}
