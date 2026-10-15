import type { RiskAssessment } from '@fairtrip/contracts';
import { Chip } from './Chip.js';
import { riskLevelLabel, signalLabel } from '../lib/present.js';

interface RiskPanelProps { risk: RiskAssessment | undefined }

const PARTIES = ['rider', 'driver'] as const;

/** The Risk Analyst's context-only assessment; never a verdict. */
export function RiskPanel({risk}: RiskPanelProps) {
  if (risk === undefined) return null;
  return (
    <section className="panel risk-panel" aria-labelledby="risk-heading">
      <h2 id="risk-heading" className="panel-title">Risk analyst</h2>
      <p>
        <strong className="risk-level">{riskLevelLabel(risk.overall)}</strong>
        {' '}
        <span className="risk-source">
          {risk.source === 'model'
            ? 'Summary written by the model from server-computed signals'
            : "Server-computed signals; the model's summary was unavailable"}
        </span>
      </p>
      <p className="risk-summary">{risk.summary}</p>
      {PARTIES.map(party => {
        const signals = risk.signals.filter(signal => signal.party === party);
        if (signals.length === 0) return null;
        return (
          <div key={party} className="risk-party">
            <h3 className="risk-party-label">{party === 'rider' ? 'Rider' : 'Driver'}</h3>
            <ul className="risk-signals">
              {signals.map((signal, index) => (
                <li key={`${signal.code}-${index}`} className="risk-signal">
                  <p>
                    <span className="risk-signal-name">{signalLabel(signal.code)}</span>
                    {' '}
                    <span className="risk-signal-severity">({signal.severity})</span>
                  </p>
                  <p className="risk-signal-detail">{signal.detail}</p>
                  {signal.evidenceIds.length === 0 ? null : (
                    <div className="chip-row">
                      {signal.evidenceIds.map((id, chipIndex) => <Chip key={`ev-${id}-${chipIndex}`} id={id} kind="evidence" />)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="risk-caveat">{risk.caveat}</p>
    </section>
  );
}
