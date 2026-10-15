import type { Run } from '@fairtrip/contracts';
import { evidenceLabel } from '../lib/present.js';
import { Gauges } from './Gauges.js';
import type { EvidenceCard, Family } from '../lib/view-model.js';

interface EvidencePanelProps { evidence: Record<Family, EvidenceCard[]>; status: Run['status'] | null }

const GROUPS: {family: Family; heading: string}[] = [
  {family: 'gps', heading: 'GPS'},
  {family: 'chat', heading: 'Chat'},
  {family: 'payment', heading: 'Payment'},
  {family: 'history', heading: 'History'},
];

function RetrievedBy({actors}: {actors: ('rider' | 'driver')[]}) {
  if (actors.length === 0) return <p className="evidence-retrieved">Retrieved by <span className="evidence-retrieved-none">Not recorded in the activity log</span></p>;
  return (
    <p className="evidence-retrieved">
      Retrieved by{' '}
      {actors.map((actor, index) => (
        <span key={actor}>
          {index > 0 ? ' and ' : ''}
          <span className={actor === 'rider' ? 'rider-text' : 'driver-text'}>{actor === 'rider' ? 'Rider' : 'Driver'}</span>
        </span>
      ))}
    </p>
  );
}

function EvidenceCardView({card}: {card: EvidenceCard}) {
  const label = evidenceLabel(card);
  const sender = card.facts['sender'];
  const isMessage = card.kind === 'chat_message' && card.text !== null && (sender === 'rider' || sender === 'driver');
  return (
    <article id={`ev-${card.id}`} className="evidence-card">
      <h3 className="evidence-label">{label}</h3>
      <p className="mono evidence-id">{card.id}</p>
      <RetrievedBy actors={card.retrievedBy} />
      {isMessage ? (
        <p className={sender === 'rider' ? 'bubble bubble-rider' : 'bubble bubble-driver'}>{card.text}</p>
      ) : (
        <p className="evidence-summary">{card.summary}</p>
      )}
      {card.tags.length === 0 ? null : <p className="evidence-tags">{`Tags: ${card.tags.join(', ')}`}</p>}
      {card.instructionLike ? <p className="instruction-badge">Instruction-like text, treated as evidence only</p> : null}
      <details>
        <summary>Show data</summary>
        <pre>{JSON.stringify(card.facts, null, 2)}</pre>
      </details>
    </article>
  );
}

export function EvidencePanel({evidence, status}: EvidencePanelProps) {
  const groups = GROUPS.filter(({family}) => evidence[family].length > 0);
  const empty = GROUPS.filter(({family}) => evidence[family].length === 0).map(({heading}) => heading);
  const running = status === 'queued' || status === 'running' || status === null;
  return (
    <section className="panel locker" aria-labelledby="evidence-heading">
      <h2 id="evidence-heading" className="panel-title">Evidence locker</h2>
      <Gauges evidence={evidence} />
      {groups.length === 0 ? (
        <p className="placeholder">
          {running ? 'Records appear here as the advocates retrieve them.' : 'No evidence was retrieved in this run.'}
        </p>
      ) : (
        <>
          <div className="evidence-groups">
            {groups.map(({family, heading}) => (
              <div key={family} className="evidence-group">
                <h3 className="evidence-group-heading">{heading}</h3>
                {evidence[family].map(card => <EvidenceCardView key={card.id} card={card} />)}
              </div>
            ))}
          </div>
          {empty.length === 0 ? null : <p className="locker-empty-note">{`No records: ${empty.join(', ')}`}</p>}
        </>
      )}
    </section>
  );
}
