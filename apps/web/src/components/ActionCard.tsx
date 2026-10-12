import { formatSgd, remedyLabel } from '../lib/format.js';
import type { CompletedResult } from '../lib/view-model.js';

interface ActionCardProps { result: CompletedResult }

function recipientLabel(recipient: 'rider' | 'driver' | 'none'): string {
  if (recipient === 'rider') return 'Rider';
  if (recipient === 'driver') return 'Driver';
  return 'No recipient';
}

export function ActionCard({result}: ActionCardProps) {
  const action = result.action;
  return (
    <section className="panel action-card" aria-labelledby="action-heading">
      <h2 id="action-heading" className="panel-title">Action</h2>
      <p className="action-remedy">{remedyLabel(action.remedyId)}</p>
      <p className="action-amount">{formatSgd(action.amountCents)}</p>
      <p className="action-recipient">Recipient: {recipientLabel(action.recipient)}</p>
      <p className="action-recommendation">{action.recommendation}</p>
      <p className="action-note">Amount calculated by the server from the evidence, not by the model.</p>
    </section>
  );
}
