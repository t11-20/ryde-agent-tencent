import type { RunView } from "../contracts/provisional";
import type { UiStatus } from "../state/useRun";
import { Chips } from "./citations";

/** Contract: confidence in [0, 1]. Anything else is shown as given, never silently rescaled. */
export function formatConfidence(c: number): string {
  return c >= 0 && c <= 1 ? `${Math.round(c * 100)}%` : `${c} (outside the expected 0–1 scale)`;
}

export function JudgePanel({ view, status }: { view?: RunView; status: UiStatus }) {
  const judge = view?.result?.judge;
  return (
    <section className="panel judge" aria-label="Judge">
      <h2><span className="badge actor-judge">judge</span> Judge</h2>
      {!judge ? (
        <p className="muted">
          {status === "failed" ? "No validated ruling: the run failed." :
            status === "incomplete" ? "No ruling issued: the case is incomplete and needs human review." :
            status === "contract_mismatch" ? "No ruling shown: the API response did not match the contract." :
            "Awaiting the Judge."}
        </p>
      ) : (
        <>
          <div className="ruling"><span className="mono">{judge.ruling}</span></div>
          <h4>Findings</h4>
          <ul>{judge.findings.map((f, i) => <li key={i}>{f.point} <Chips evidenceIds={f.evidenceIds} policyIds={f.policyIds} /></li>)}</ul>
          <div className="confidence">Model-assessed confidence: <strong>{formatConfidence(judge.confidence)}</strong></div>
          <h4>Reasoning</h4>
          <p>{judge.reasoning}</p>
          <div className="explanations">
            <div className="explain"><h4>Explanation to rider</h4><p>{judge.riderExplanation}</p></div>
            <div className="explain"><h4>Explanation to driver</h4><p>{judge.driverExplanation}</p></div>
          </div>
        </>
      )}
    </section>
  );
}
