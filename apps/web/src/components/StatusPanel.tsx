import { useEffect, useState } from "react";
import { RUN_DEADLINE_SEC } from "../config";
import type { RunState } from "../state/useRun";

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - since) / 1000));
  const pct = Math.min(100, (sec / RUN_DEADLINE_SEC) * 100);
  return (
    <div className="elapsed-wrap">
      <span className="mono">{sec}s elapsed</span> · deadline {RUN_DEADLINE_SEC}s{sec > RUN_DEADLINE_SEC && <strong> · deadline passed, waiting for the controller</strong>}
      <div className="deadline-bar" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export interface StatusPanelProps {
  state: RunState;
  onRunAgain(): void;
  onKeepWaiting(): void;
  onStop(): void;
}

export function StatusPanel({ state, onRunAgain, onKeepWaiting, onStop }: StatusPanelProps) {
  const s = state.status;
  const missing = state.view?.missingEvidence ?? [];
  let body;
  if (state.stalled) {
    body = (
      <div className="state state-failed" role="alert">
        <strong>Failed: lost contact with the API</strong> after 5 consecutive polling errors ({state.error?.message}).
        <div className="buttons"><button type="button" onClick={onKeepWaiting}>Keep waiting</button><button type="button" onClick={onStop}>Stop</button></div>
      </div>
    );
  } else if (s === "idle") body = <div className="state state-idle">Idle. Select a dispute and press Resolve.</div>;
  else if (s === "submitting") body = <div className="state state-running">Submitting…</div>;
  else if (s === "queued" || s === "running") {
    body = <div className="state state-running"><strong>{s === "queued" ? "Queued" : "Running"}</strong> {state.startedAtMs !== undefined && <Elapsed since={state.startedAtMs} />}</div>;
  } else if (s === "completed") body = <div className="state state-completed"><strong>Completed.</strong> Ruling validated.</div>;
  else if (s === "incomplete") {
    body = (
      <div className="state state-incomplete" role="status">
        <strong>Incomplete: human review required.</strong> No ruling or amount is issued (GEN-1).
        {missing.length > 0 ? (
          <ul className="missing-list">{missing.map((m) => <li key={m.family}><span className="mono">{m.family}</span>: {m.reason}</li>)}</ul>
        ) : <p>The API did not list the missing evidence.</p>}
      </div>
    );
  } else if (s === "failed") {
    body = (
      <div className="state state-failed" role="alert">
        <strong>Failed.</strong> <span className="mono">{state.error?.code ?? "unknown_error"}</span>: {state.error?.message ?? "The run failed without an error message."}
        <div className="buttons"><button type="button" onClick={onRunAgain}>Run again</button></div>
      </div>
    );
  } else if (s === "contract_mismatch") {
    body = (
      <div className="state state-mismatch" role="alert">
        <strong>Contract mismatch.</strong> The response from <span className="mono">{state.mismatch?.endpoint}</span> did not match the expected contract.
        <pre className="issues">{JSON.stringify(state.mismatch?.issues, null, 2)}</pre>
        <div className="buttons"><button type="button" onClick={onRunAgain}>Run again</button></div>
      </div>
    );
  }
  return (
    <section className="panel status-panel" aria-label="Run status" data-status={state.stalled ? "stalled" : s}>
      <h2>Run status {state.runId && <span className="mono small">{state.runId}</span>}</h2>
      {body}
    </section>
  );
}
