import type { EvidenceCard, Family } from '../lib/view-model.js';

interface EvidencePanelProps {
  evidence: Record<Family, EvidenceCard[]>;
  /** Retrieved-record IDs; kept for the documented component API. Cards here are always known. */
  knownIds: Set<string>;
}

const COLUMNS: {family: Family; heading: string}[] = [
  {family: 'gps', heading: 'GPS'},
  {family: 'chat', heading: 'Chat'},
  {family: 'payment', heading: 'Payment'},
  {family: 'history', heading: 'History'}
];

function retrievedByLabel(actors: ('rider' | 'driver')[]): string {
  if (actors.length === 0) return 'Retrieved by: not recorded in the activity log';
  const names = actors.map(actor => (actor === 'rider' ? 'rider' : 'driver'));
  return `Retrieved by ${names.join(' and ')}`;
}

function EvidenceCardView({card}: {card: EvidenceCard}) {
  return (
    <article id={`ev-${card.id}`} className="evidence-card">
      <h4 className="evidence-id">{card.id}</h4>
      <p className="evidence-summary">{card.summary}</p>
      <p className="evidence-retrieved">{retrievedByLabel(card.retrievedBy)}</p>
      {card.text === null ? null : <p className="evidence-text">{`"${card.text}"`}</p>}
      {card.tags.length === 0 ? null : (
        <p className="tag-row">{card.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}</p>
      )}
      {card.instructionLike ? <p className="instruction-badge">Instruction-like text, treated as evidence only</p> : null}
      <details>
        <summary>Facts</summary>
        <pre>{JSON.stringify(card.facts, null, 2)}</pre>
      </details>
    </article>
  );
}

export function EvidencePanel({evidence}: EvidencePanelProps) {
  return (
    <section className="panel" aria-labelledby="evidence-heading">
      <h2 id="evidence-heading" className="panel-title">Evidence</h2>
      <div className="evidence-columns">
        {COLUMNS.map(({family, heading}) => (
          <div key={family} className="evidence-column">
            <h3>{heading}</h3>
            {evidence[family].length === 0 ? (
              <p className="placeholder">No records retrieved.</p>
            ) : (
              evidence[family].map(card => <EvidenceCardView key={card.id} card={card} />)
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
