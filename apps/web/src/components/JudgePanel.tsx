import type { AdvocateCase, Run } from '@fairtrip/contracts';
import { Chip } from './Chip.js';
import { useClampToggle } from './Clamp.js';
import type { CompletedResult } from '../lib/view-model.js';

interface JudgePanelProps {
  result: CompletedResult | null;
  status: Run['status'];
}

type Argument = AdvocateCase['arguments'][number];

function FindingItem({finding}: {finding: Argument}) {
  return (
    <li className="argument">
      <p>{finding.claim}</p>
      <div className="chip-row">
        {finding.evidenceIds.map((id, index) => <Chip key={`ev-${id}-${index}`} id={id} kind="evidence" />)}
        {finding.policyClauseIds.map((id, index) => <Chip key={`pol-${id}-${index}`} id={id} kind="policy" />)}
      </div>
    </li>
  );
}

export function JudgePanel({result, status}: JudgePanelProps) {
  const {ref, expanded, showToggle, toggle} = useClampToggle(result === null ? null : result.reasoning);
  return (
    <section className="panel judge-panel hearing-judge" aria-labelledby="judge-heading">
      <h2 id="judge-heading" className="advocate-title judge-title">Judge's findings</h2>
      {result === null ? (
        status === 'queued' || status === 'running' || status === null ? (
          <p className="placeholder">Waiting for both advocate cases…</p>
        ) : (
          <>
            <p className="judge-no-ruling">No ruling</p>
            <p className="placeholder judge-no-ruling-note">
              {status === 'failed' ? 'The run failed before the Judge ruled.' : 'Decisive evidence was missing.'}
            </p>
          </>
        )
      ) : (
        <>
          {result.findings.length === 0 ? <p className="placeholder">No findings.</p> : (
            <ul className="argument-list">
              {result.findings.map((finding, index) => <FindingItem key={index} finding={finding} />)}
            </ul>
          )}
          <div ref={ref}>
            <p className={expanded ? 'clamp clamp-4 clamp-open' : 'clamp clamp-4'}>{result.reasoning}</p>
            <div className="judge-explanations">
              <div>
                <h3 className="judge-explanation-label">To the rider</h3>
                <p className={expanded ? 'clamp clamp-3 clamp-open' : 'clamp clamp-3'}>{result.riderExplanation}</p>
              </div>
              <div>
                <h3 className="judge-explanation-label">To the driver</h3>
                <p className={expanded ? 'clamp clamp-3 clamp-open' : 'clamp clamp-3'}>{result.driverExplanation}</p>
              </div>
            </div>
            {showToggle ? (
              <button type="button" className="btn-text" aria-expanded={expanded} onClick={toggle}>
                {expanded ? 'Show less' : 'Read full reasoning'}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
