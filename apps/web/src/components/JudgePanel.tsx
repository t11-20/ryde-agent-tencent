import type { AdvocateCase, Run } from '@fairtrip/contracts';
import { Chip } from './Chip.js';
import { percent, rulingLabel } from '../lib/format.js';
import type { CompletedResult } from '../lib/view-model.js';

interface JudgePanelProps {
  result: CompletedResult | null;
  knownIds: Set<string>;
  status: Run['status'];
}

type Argument = AdvocateCase['arguments'][number];

function FindingItem({finding, knownIds}: {finding: Argument; knownIds: Set<string>}) {
  return (
    <li>
      <p>{finding.claim}</p>
      <div className="chip-row">
        {finding.evidenceIds.map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" known={knownIds.has(id)} />)}
        {finding.policyClauseIds.map((id, index) => <Chip key={`pol-${id}-${index}`} id={id} kind="policy" known={knownIds.has(id)} />)}
      </div>
    </li>
  );
}

export function JudgePanel({result, knownIds, status}: JudgePanelProps) {
  return (
    <section className="panel panel-judge" aria-labelledby="judge-heading">
      <h2 id="judge-heading" className="panel-title">Judge</h2>
      {result === null ? (
        <p className="placeholder">
          {status === 'incomplete'
            ? 'No ruling or payment was issued; this case needs human review.'
            : status === 'failed'
              ? 'The Judge issued no ruling.'
              : 'Waiting for both advocate cases…'}
        </p>
      ) : (
        <>
          <p className="judge-ruling">{rulingLabel(result.ruling)}</p>
          <div className="panel-section">
            <h3>Findings</h3>
            {result.findings.length === 0 ? <p className="placeholder">None.</p> : (
              <ul>{result.findings.map((finding, index) => <FindingItem key={index} finding={finding} knownIds={knownIds} />)}</ul>
            )}
          </div>
          <div className="confidence">
            <p>Model-assessed confidence {percent(result.confidence)}</p>
            <div className="confidence-bar" role="img" aria-label={`Model-assessed confidence ${percent(result.confidence)}`}>
              <div className="confidence-fill" style={{width: `${percent(result.confidence)}`}} />
            </div>
          </div>
          <div className="panel-section">
            <h3>Reasoning</h3>
            <p>{result.reasoning}</p>
          </div>
          <div className="judge-explanations">
            <div className="panel-section">
              <h3>To the rider</h3>
              <p>{result.riderExplanation}</p>
            </div>
            <div className="panel-section">
              <h3>To the driver</h3>
              <p>{result.driverExplanation}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
