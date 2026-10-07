import { formatSgd } from "@fairtrip/evidence";
import type { RunView } from "../contracts/provisional";
import type { UiStatus } from "../state/useRun";

/** Shown only when the run completed with a result. Never shown for failed or incomplete runs. */
export function ActionCard({ view, status }: { view?: RunView; status: UiStatus }) {
  if (status !== "completed" || !view?.result) return null;
  const a = view.result.action;
  return (
    <section className="panel action-card" aria-label="Recommended action" data-testid="action-card">
      <h2>Recommended action</h2>
      <div className="action-row"><span>Remedy</span><span className="mono">{a.remedyId}</span></div>
      <div className="action-row"><span>Amount</span><span className="amount">{formatSgd(a.amountCents)}</span></div>
      <div className="action-row"><span>Recipient</span><span>{a.recipient === "rider" ? "Rider" : "None (charge kept)"}</span></div>
      <p>{a.text}</p>
    </section>
  );
}
