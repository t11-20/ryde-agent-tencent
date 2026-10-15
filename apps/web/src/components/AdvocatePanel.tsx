import { Chip } from './Chip.js';
import { useClampToggle } from './Clamp.js';
import type { AdvocateCase, Run } from '@fairtrip/contracts';
import { remedyLabel } from '../lib/format.js';
import { plural } from '../lib/present.js';
import type { SidePanel } from '../lib/view-model.js';

type Argument = AdvocateCase['arguments'][number];

interface AdvocatePanelProps {
  actor: 'rider' | 'driver';
  side: SidePanel;
  status: Run['status'] | null;
}

function ArgumentItem({argument, expanded}: {argument: Argument; expanded: boolean}) {
  return (
    <li className="argument">
      <p className={expanded ? 'clamp clamp-2 clamp-open' : 'clamp clamp-2'}>{argument.claim}</p>
      <div className="chip-row">
        {argument.evidenceIds.map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" />)}
        {argument.policyClauseIds.map((id, index) => <Chip key={`pol-${id}-${index}`} id={id} kind="policy" />)}
      </div>
    </li>
  );
}

export function AdvocatePanel({actor, side, status}: AdvocatePanelProps) {
  const advocateCase = side.advocateCase;
  const {ref, expanded, showToggle, toggle} = useClampToggle(advocateCase);
  const title = actor === 'rider' ? 'Rider Advocate' : 'Driver Advocate';
  const evidenceCount = side.retrievedEvidenceIds.length;
  const policyCount = side.retrievedPolicyIds.length;
  const counterCount = advocateCase === null ? 0 : advocateCase.counterevidence.length;
  const missingCount = advocateCase === null ? 0 : advocateCase.missingFacts.length;
  const counterParts = [
    counterCount > 0 ? `Counterevidence (${counterCount})` : '',
    missingCount > 0 ? `missing facts (${missingCount})` : '',
  ].filter(part => part !== '').join(' and ');

  return (
    <section className={`panel advocate advocate-${actor} hearing-${actor}`} aria-labelledby={`${actor}-advocate-heading`}>
      <h2 id={`${actor}-advocate-heading`} className="advocate-title">{title}</h2>
      <div ref={ref} className="advocate-body">
        {advocateCase === null ? (
          <p className="placeholder">{status === 'queued' || status === 'running' || status === null ? 'Gathering evidence' : 'Stopped before submitting a case'}</p>
        ) : (
          <>
            <p className="advocate-asks">{`Asks for: ${advocateCase.requestedRemedyId === undefined ? '—' : remedyLabel(advocateCase.requestedRemedyId)}`}</p>
            <p className={expanded ? 'clamp clamp-4 clamp-open' : 'clamp clamp-4'}>{advocateCase.summary}</p>
            {advocateCase.arguments.length === 0 ? null : (
              <ul className="argument-list">
                {advocateCase.arguments.map((argument, index) => <ArgumentItem key={index} argument={argument} expanded={expanded} />)}
              </ul>
            )}
          </>
        )}
      </div>
      {showToggle ? (
        <button type="button" className="btn-text" aria-expanded={expanded} onClick={toggle}>
          {expanded ? 'Show less' : 'Read full case'}
        </button>
      ) : null}
      {advocateCase !== null && (counterCount > 0 || missingCount > 0) ? (
        <details className="advocate-details">
          <summary>{counterParts}</summary>
          {counterCount === 0 ? null : (
            <ul className="argument-list">
              {advocateCase.counterevidence.map((argument, index) => <ArgumentItem key={index} argument={argument} expanded={true} />)}
            </ul>
          )}
          {missingCount === 0 ? null : (
            <ul className="missing-list">
              {advocateCase.missingFacts.map((fact, index) => <li key={index}>{fact}</li>)}
            </ul>
          )}
        </details>
      ) : null}
      {evidenceCount + policyCount === 0 ? null : (
        <footer className="advocate-footer">
          <p className="advocate-gathered">{`Gathered ${plural(evidenceCount, 'record', 'records')} and ${plural(policyCount, 'clause', 'clauses')}`}</p>
          {evidenceCount === 0 ? null : (
            <div className="chip-row">
              {side.retrievedEvidenceIds.slice(0, 4).map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" />)}
              {evidenceCount > 4 ? <span className="advocate-more">{`and ${evidenceCount - 4} more`}</span> : null}
            </div>
          )}
        </footer>
      )}
    </section>
  );
}
