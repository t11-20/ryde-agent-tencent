import { Chip } from './Chip.js';
import type { AdvocateCase } from '@fairtrip/contracts';
import { remedyLabel } from '../lib/format.js';
import type { SidePanel } from '../lib/view-model.js';

type Argument = AdvocateCase['arguments'][number];

interface AdvocatePanelProps {
  title: string;
  actor: 'rider' | 'driver';
  side: SidePanel;
  knownIds: Set<string>;
}

function ArgumentItem({argument, knownIds}: {argument: Argument; knownIds: Set<string>}) {
  return (
    <li>
      <p>{argument.claim}</p>
      <div className="chip-row">
        {argument.evidenceIds.map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" known={knownIds.has(id)} />)}
        {argument.policyClauseIds.map((id, index) => <Chip key={`pol-${id}-${index}`} id={id} kind="policy" known={knownIds.has(id)} />)}
      </div>
    </li>
  );
}

export function AdvocatePanel({title, actor, side, knownIds}: AdvocatePanelProps) {
  const advocateCase = side.advocateCase;
  return (
    <section className={`panel panel-${actor}`} aria-labelledby={`${actor}-advocate-heading`}>
      <h2 id={`${actor}-advocate-heading`} className="panel-title">{title}</h2>
      {side.toolRequests.length === 0 ? null : (
        <div className="panel-section">
          <h3>Tool requests</h3>
          <ul>{side.toolRequests.map((request, index) => <li key={index}>{request}</li>)}</ul>
        </div>
      )}
      <div className="panel-section">
        <h3>Retrieved records</h3>
        {side.retrievedEvidenceIds.length === 0 && side.retrievedPolicyIds.length === 0 ? (
          <p className="placeholder">None yet.</p>
        ) : (
          <div className="chip-row">
            {side.retrievedEvidenceIds.map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" known={knownIds.has(id)} />)}
            {side.retrievedPolicyIds.map((id, index) => <Chip key={`pol-${id}-${index}`} id={id} kind="policy" known={knownIds.has(id)} />)}
          </div>
        )}
      </div>
      {advocateCase === null ? (
        <p className="placeholder">Gathering evidence…</p>
      ) : (
        <>
          <div className="panel-section">
            <h3>Case summary</h3>
            <p>{advocateCase.summary}</p>
          </div>
          <div className="panel-section">
            <h3>Arguments</h3>
            {advocateCase.arguments.length === 0 ? <p className="placeholder">None.</p> : (
              <ul>{advocateCase.arguments.map((argument, index) => <ArgumentItem key={index} argument={argument} knownIds={knownIds} />)}</ul>
            )}
          </div>
          <div className="panel-section">
            <h3>Counterevidence</h3>
            {advocateCase.counterevidence.length === 0 ? <p className="placeholder">None.</p> : (
              <ul>{advocateCase.counterevidence.map((argument, index) => <ArgumentItem key={index} argument={argument} knownIds={knownIds} />)}</ul>
            )}
          </div>
          <div className="panel-section">
            <h3>Requested remedy</h3>
            <p>{remedyLabel(advocateCase.requestedRemedyId)}</p>
          </div>
          {advocateCase.missingFacts.length === 0 ? null : (
            <div className="panel-section">
              <h3>Missing facts</h3>
              <ul>{advocateCase.missingFacts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
