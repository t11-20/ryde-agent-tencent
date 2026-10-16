import type { RiskAssessment } from '@fairtrip/contracts';
import { riskLevelLabel, signalLabel } from '../lib/present.js';
import { KeyPoints, PreviewCitation } from './KeyPoints.js';

const PARTIES = ['rider', 'driver'] as const;

/** The Risk Analyst's context-only assessment; never a verdict. */
export function CompactRiskPanel({risk}: {risk: RiskAssessment | undefined}) {
  if (risk === undefined) return null;
  return (
    <section className="panel risk-panel glass-summary-panel" aria-labelledby="glass-risk-heading">
      <div className="glass-section-heading">
        <h2 id="glass-risk-heading" className="advocate-title">Risk analyst</h2>
        <span className="glass-evidence-note">Context only; never decides the outcome</span>
      </div>
      <p className="glass-risk-level">
        <strong className="risk-level">{riskLevelLabel(risk.overall)}</strong>
        {' '}
        <span className="risk-source">
          {risk.source === 'model'
            ? 'Summary written by the model from server-computed signals'
            : "Server-computed signals; the model's summary was unavailable"}
        </span>
      </p>
      <KeyPoints text={risk.summary} maxPoints={2} fullTextLabel="Full summary" />
      {PARTIES.map(party => {
        const signals = risk.signals.filter(signal => signal.party === party);
        if (signals.length === 0) return null;
        return (
          <div key={party} className="risk-party">
            <h3 className="risk-party-label">{party === 'rider' ? 'Rider' : 'Driver'}</h3>
            <ul className="risk-signals glass-key-points">
              {signals.map((signal, index) => (
                <li key={`${signal.code}-${index}`} className="risk-signal">
                  <p>
                    <span className="risk-signal-name">{signalLabel(signal.code)}</span>
                    {' '}
                    <span className="risk-signal-severity">({signal.severity})</span>
                    {' — '}
                    <span className="risk-signal-detail">{signal.detail}</span>
                  </p>
                  {signal.evidenceIds.length === 0 ? null : (
                    <div className="chip-row">
                      {signal.evidenceIds.map((id, chipIndex) => <PreviewCitation key={`ev-${id}-${chipIndex}`} id={id} kind="evidence" />)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <ul className="glass-key-points"><li>{risk.caveat}</li></ul>
    </section>
  );
}
