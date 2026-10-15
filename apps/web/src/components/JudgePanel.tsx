import type { AdvocateCase, PolicyVerdict, Precedent, Run } from '@fairtrip/contracts';
import { Chip } from './Chip.js';
import { useClampToggle } from './Clamp.js';
import { precedentOriginLabel, verdictAgreement, verdictLine } from '../lib/present.js';
import { remedyLabel } from '../lib/format.js';
import type { CompletedResult } from '../lib/view-model.js';

interface JudgePanelProps {
  result: CompletedResult | null;
  status: Run['status'];
  precedents: Precedent[];
  precedentsSeen: boolean;
  /** Deterministic policy verdict — present on live and replay runs. */
  verdict: PolicyVerdict | undefined;
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

export function JudgePanel({result, status, precedents, precedentsSeen, verdict}: JudgePanelProps) {
  const {ref, expanded, showToggle, toggle} = useClampToggle(result === null ? null : result.reasoning);
  const agreement = verdictAgreement(verdict, status === 'completed' && result !== null ? result.action.remedyId : null);
  return (
    <section className="panel judge-panel hearing-judge" aria-labelledby="judge-heading">
      <h2 id="judge-heading" className="advocate-title judge-title">Judge's findings</h2>
      {verdict === undefined ? null : (
        <div className="judge-verdict">
          <h3 className="judge-explanation-label">Policy verdict</h3>
          <p className="judge-verdict-line">{verdictLine(verdict)}</p>
          {agreement === null ? null : <p className="precedents-note">{agreement}</p>}
        </div>
      )}
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
      {precedentsSeen ? (
        <div className="precedents">
          <h3 className="precedents-title">Precedents considered</h3>
          {precedents.length === 0 ? (
            <p className="precedents-note">No similar past ruling.</p>
          ) : (
            <ul className="precedents-list">
              {precedents.map(precedent => (
                <li key={precedent.id} className="precedent">
                  <p className="clamp clamp-2">{`${precedentOriginLabel(precedent.origin)} · ${remedyLabel(precedent.remedyId)} · ${precedent.summary}`}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="precedents-note">For consistency only; never overrides this case's evidence.</p>
        </div>
      ) : null}
    </section>
  );
}
