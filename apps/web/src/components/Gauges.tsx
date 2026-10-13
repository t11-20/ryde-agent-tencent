import { formatCount, paymentGauge, pickupGauge, routeGauge } from '../lib/present.js';
import type { Facts, Meter, PickupGauge, RouteGauge, PaymentView } from '../lib/present.js';
import type { EvidenceCard, Family } from '../lib/view-model.js';

function findFacts(evidence: Record<Family, EvidenceCard[]>, kind: string): Facts | null {
  for (const family of Object.keys(evidence) as Family[]) {
    const card = evidence[family].find(item => item.facts['kind'] === kind);
    if (card !== undefined) return card.facts;
  }
  return null;
}

function RouteGaugeView({gauge}: {gauge: RouteGauge}) {
  const barLabel = `Reference route ${formatCount(gauge.referenceMeters)} m, actual route ${formatCount(gauge.actualMeters)} m. ${gauge.caption}`;
  return (
    <div className="gauge gauge-route">
      <h3 className="gauge-heading">Route vs reference</h3>
      <div className="route-gauge-grid" role="img" aria-label={barLabel}>
        <span aria-hidden="true" />
        <div className="route-marker-lane">
          <span
            className="route-marker-label"
            style={gauge.markerPct > 50
              ? {left: `${gauge.markerPct}%`, transform: 'translateX(-100%)', paddingRight: 8}
              : {left: `${gauge.markerPct}%`, paddingLeft: 8}}
          >
            Material beyond this point
          </span>
        </div>
        <span className="route-bar-label">Reference route <span className="gauge-value">{formatCount(gauge.referenceMeters)} m</span></span>
        <div className="route-bars">
          <div className="route-track">
            <div className="route-fill route-fill-system" style={{width: `${gauge.referencePct}%`}} />
          </div>
          <div className="route-track route-track-actual">
            <span className="route-fill route-fill-ink" style={{width: `${gauge.actualWithinPct}%`}} />
            <span className="route-fill route-fill-warn" style={{width: `${gauge.actualBeyondPct}%`}} />
          </div>
          <span className="route-threshold" style={{left: `${gauge.markerPct}%`}} aria-hidden="true" />
        </div>
        <span className="route-bar-label">Actual route <span className="gauge-value">{formatCount(gauge.actualMeters)} m</span></span>
      </div>
      <p className="gauge-caption">{gauge.caption}</p>
      <p className="gauge-sub">{`Unexpected stops: ${gauge.stops}`}</p>
    </div>
  );
}

function MeterView({meter}: {meter: Meter}) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-label">{meter.label}</span>
        <span className={meter.met ? 'meter-met' : 'meter-met meter-met-fail'}>{meter.met ? 'Met' : 'Not met'}</span>
      </div>
      <div className="meter-track">
        {meter.valuePct === null ? null : <div className="meter-fill" style={{width: `${meter.valuePct}%`}} />}
        <span className="meter-limit" style={{left: `${meter.limitPct}%`}} />
      </div>
      <div className="meter-foot">
        <span className="meter-value">{meter.valueText}</span>
        <span className="meter-limit-text">{meter.limitText}</span>
      </div>
    </div>
  );
}

function PickupGaugeView({gauge}: {gauge: PickupGauge}) {
  return (
    <div className="gauge">
      <h3 className="gauge-heading">No-show conditions</h3>
      <div className="meter-grid">
        <MeterView meter={gauge.distance} />
        <MeterView meter={gauge.wait} />
        {gauge.contact === null ? null : <MeterView meter={gauge.contact} />}
      </div>
    </div>
  );
}

function PaymentGaugeView({view}: {view: PaymentView}) {
  return (
    <div className="gauge">
      <h3 className="gauge-heading">Fare and refund basis</h3>
      <dl className="fare-list">
        {view.lineItems.map(item => (
          <div key={item.label} className="fare-row">
            <dt>{item.label}</dt>
            <dd>{item.amount}</dd>
          </div>
        ))}
        <div className="fare-row fare-row-total">
          <dt>Total</dt>
          <dd>{view.total}</dd>
        </div>
        <div className="fare-row">
          <dt>Paid</dt>
          <dd>{view.paid}</dd>
        </div>
      </dl>
      {view.remedies.length === 0 ? null : (
        <>
          <p className="gauge-sub">Eligible amounts computed by the server</p>
          <ul className="remedy-list">
            {view.remedies.map(remedy => (
              <li key={remedy.remedyId}>
                <span>{remedy.label}</span>
                <span className="remedy-amount">{remedy.amount ?? `Unavailable: ${remedy.note ?? 'reason not recorded'}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function Gauges({evidence}: {evidence: Record<Family, EvidenceCard[]>}) {
  const route = routeGauge(findFacts(evidence, 'route_metrics'));
  const pickup = pickupGauge(findFacts(evidence, 'pickup_metrics'), findFacts(evidence, 'chat_summary'));
  const payment = paymentGauge(findFacts(evidence, 'fare_breakdown'), findFacts(evidence, 'remedy_basis'));
  if (route === null && pickup === null && payment === null) return null;
  return (
    <div className="gauges">
      {route === null ? null : <RouteGaugeView gauge={route} />}
      {pickup === null ? null : <PickupGaugeView gauge={pickup} />}
      {payment === null ? null : <PaymentGaugeView view={payment} />}
    </div>
  );
}
