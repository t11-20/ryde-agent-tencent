import { useContext } from 'react';
import { flushSync } from 'react-dom';
import type { AdvocateCase, Run } from '@fairtrip/contracts';
import { ChipContext } from '../components/Chip.js';
import { remedyLabel } from '../lib/format.js';
import { clauseLabel } from '../lib/present.js';
import type { CompletedResult, SidePanel } from '../lib/view-model.js';

type Argument = AdvocateCase['arguments'][number];
const displayTime = new Intl.DateTimeFormat('en-SG', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore'});

/** Display names replace source identifiers; the underlying case remains unchanged. */
export function readableText(text: string, evidenceLabels: Map<string, string> = new Map()): string {
  let display = text;
  const names = [...evidenceLabels].sort(([left], [right]) => right.length - left.length);
  for (const [id, label] of names) {
    if (id === label) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    display = display.replace(new RegExp(`\\b${escaped}\\b`, 'g'), () => label);
  }
  return display
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, timestamp => {
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? timestamp : `${displayTime.format(date)} SGT`;
    })
    .replace(/Scripted (rider|driver) argument citing the first retrieved evidence and policy \(test double\)\./g, (_, party: string) => `${party === 'rider' ? 'Rider' : 'Driver'} position for this illustrative hearing. Detailed arguments are not available in this example.`)
    .replace(/Scripted (rider|driver) advocate case \(test double\)\./g, (_, party: string) => `Illustrative ${party} case. Full advocate reasoning is not available in this example.`)
    .replace(/Scripted test double finding based on the expected outcome\./g, 'Illustrative outcome for this example. Detailed findings are not available.')
    .replace(/Scripted test double: ruling and remedy copied from the expected-outcome dataset\./g, 'This is an illustrative outcome. A full decision rationale is not available in this example.')
    .replace(/Scripted test double explanation for the (rider|driver)\./g, (_, party: string) => `Illustrative ${party} explanation. A full explanation is not available in this example.`)
    .replace(/\b(?:RD|NS)-\d+\b/g, id => clauseLabel(id) === id ? 'the demonstration policy' : clauseLabel(id))
    .replace(/\bADV-SYN-\d+\b/g, 'traffic advisory')
    .replace(/\broad_closure\b/g, 'road closure')
    .replace(/^gps:\s*/i, 'Location records: ')
    .replace(/^payment:\s*/i, 'Payment records: ')
    .replace(/\bsynthetic fixture\b/gi, 'synthetic example')
    .replace(/\brouting-service result\b/gi, 'navigation service result')
    .replace(/\btelemetry gap\b/gi, 'location record gap')
    .replace(/\brefund_route_excess\b/g, 'refund the excess-distance charge')
    .replace(/\brefund_no_show_fee\b/g, 'refund the no-show fee')
    .replace(/\bkeep_charge\b/g, 'keep the charge')
    .replace(/\bserver computes\b/gi, 'calculation gives')
    .replace(/\bserver reports\b/gi, 'review shows')
    .replace(/\bserver-computed\b/gi, 'calculated')
    .replace(/\bThe server computes the amount\./g, 'The amount follows the fare calculation.');
}

/** A readable, accessible source link that also reveals a filtered evidence card. */
export function PreviewCitation({id, kind}: {id: string; kind: 'evidence' | 'policy'}) {
  const {knownIds, evidenceLabels} = useContext(ChipContext);
  const known = knownIds.has(id);
  const candidate = kind === 'evidence' ? evidenceLabels.get(id) : clauseLabel(id);
  const label = candidate === undefined || candidate === id ? kind === 'evidence' ? 'Evidence item' : 'Policy reference' : candidate;
  const reveal = () => {
    if (kind === 'evidence') flushSync(() => { document.dispatchEvent(new CustomEvent('glass:reveal-evidence', {detail: {id}})); });
    window.requestAnimationFrame(() => {
      const element = document.getElementById(`${kind === 'evidence' ? 'ev' : 'pol'}-${id}`);
      if (element === null) return;
      let details = element.closest('details');
      while (details !== null) { details.open = true; details = details.parentElement?.closest('details') ?? null; }
      const paused = element.closest('.glass-preview')?.getAttribute('data-motion') === 'off';
      element.scrollIntoView({behavior: paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center'});
      element.classList.add('chip-target');
      element.focus({preventScroll: true});
      window.setTimeout(() => { element.classList.remove('chip-target'); }, 1500);
    });
  };
  return <button type="button" className={known ? 'chip' : 'chip chip-unresolved'} disabled={!known} onClick={reveal} aria-label={`${known ? 'View' : 'Unavailable'} ${label}`}><span className="chip-label">{label}</span></button>;
}

/** Extract complete source statements. No model, new facts, or calculated values. */
export function textToKeyPoints(text: string): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized === '') return [];
  // Decimal points (including currency) never match this boundary.
  const statements = normalized.split(/(?<=[.!?])\s+(?=[A-Z“"'])|;\s+/);
  const points = statements.map(statement => statement
    // These are neutral attribution phrases; the assertion remains verbatim.
    .replace(/^(?:The GPS (?:data|trace|evidence) shows (?:that )?|GPS data shows (?:that )?|The evidence shows (?:that )?|The record shows (?:that )?)/i, '')
    .trim())
    .filter(Boolean);
  return [...new Set(points)];
}

const QUALIFIER = /\b(?:no|not|never|neither|nor|missing|unverified|undocumented|unavailable|unless|if|whether|cannot|only|however|but)\b/i;
const MONEY = /(?:S\$|SGD\s*|\$)\s*\d(?:[\d,]*\d)?(?:\.\d+)?|\b\d(?:[\d,]*\d)?\s+cents?\b/i;

/** A labeled source excerpt, never presented as a complete rewritten claim. */
function pointExcerpt(point: string): {text: string; excerpt: boolean} {
  if (point.length <= 140) return {text: point, excerpt: false};
  const money = MONEY.exec(point);
  const qualifier = QUALIFIER.exec(point);
  const anchor = Math.min(money?.index ?? point.length, qualifier?.index ?? point.length);
  const start = anchor < point.length && anchor > 110
    ? Math.max(0, point.lastIndexOf(' ', Math.max(0, anchor - 35)) + 1) : 0;
  const candidate = point.slice(start, start + 136);
  const end = candidate.lastIndexOf(' ');
  const text = end > 0 ? candidate.slice(0, end) : candidate;
  return {text: `${start > 0 ? '…' : ''}${text}…`, excerpt: true};
}

function sourceMoney(text: string): string[] {
  return [...new Set(text.match(/(?:S\$|SGD\s*|\$)\s*\d(?:[\d,]*\d)?(?:\.\d+)?|\b\d(?:[\d,]*\d)?\s+cents?\b/gi) ?? [])];
}

function PointText({point, compact = true}: {point: string; compact?: boolean}) {
  const display = compact ? pointExcerpt(point) : {text: point, excerpt: false};
  return <>{display.excerpt ? <span className="glass-summary-excerpt-label">Excerpt: </span> : null}{display.text}</>;
}

/** Prefer the opening claim and its qualification/amount over incidental detail. */
function visiblePoints(points: string[], maximum: number): string[] {
  if (points.length <= maximum) return points;
  const first = points[0];
  if (first === undefined) return [];
  const important = points.filter(point => QUALIFIER.test(point) || MONEY.test(point));
  const chosen = new Set([first, ...important.slice(0, Math.max(0, maximum - 1))]);
  for (const point of points) {
    if (chosen.size >= maximum) break;
    chosen.add(point);
  }
  return points.filter(point => chosen.has(point));
}

export interface KeyPointsProps {
  text: string | string[];
  label?: string;
  fullTextLabel?: string;
  maxPoints?: number;
  showSource?: boolean;
  compact?: boolean;
}

/** Compact source bullets with readable reference names and full statements available. */
export function KeyPoints({text, label, fullTextLabel = 'Full text', maxPoints = 3, showSource = true, compact = true}: KeyPointsProps) {
  const {evidenceLabels} = useContext(ChipContext);
  const sources = (typeof text === 'string' ? [text] : text).map(source => readableText(source, evidenceLabels));
  const points = sources.flatMap(textToKeyPoints);
  if (points.length === 0) return null;
  const maximum = Math.max(1, Math.floor(maxPoints));
  const visible = visiblePoints(points, maximum);
  const amounts = sourceMoney(sources.join(' ')).filter(amount => !visible.some(point => pointExcerpt(point).text.includes(amount)));
  return (
    <div className="glass-summary-points">
      {label === undefined ? null : <h3 className="glass-summary-label">{label}</h3>}
      <ul className="glass-key-points">{visible.map((point, index) => <li key={index}><PointText point={point} compact={compact} /></li>)}</ul>
      {amounts.length === 0 ? null : <div className="glass-summary-amounts" aria-label="Amounts in the full text">{amounts.map(amount => <span key={amount}>{amount}</span>)}</div>}
      {showSource ? <details className="glass-summary-source">
        <summary>{fullTextLabel}</summary>
        <ul className="glass-key-points glass-summary-full">{sources.map((source, index) => <li key={index}>{source}</li>)}</ul>
      </details> : null}
    </div>
  );
}

function Citations({argument}: {argument: Argument}) {
  const citations = [...argument.evidenceIds.map(id => ({id, kind: 'evidence' as const})), ...argument.policyClauseIds.map(id => ({id, kind: 'policy' as const}))];
  return (
    <><div className="chip-row">{citations.slice(0, 3).map((citation, index) => <PreviewCitation key={`${citation.kind}-${citation.id}-${index}`} id={citation.id} kind={citation.kind} />)}</div>{citations.length <= 3 ? null : <details className="glass-summary-source"><summary>{citations.length - 3} more sources</summary><div className="chip-row">{citations.slice(3).map((citation, index) => <PreviewCitation key={`${citation.kind}-${citation.id}-${index}`} id={citation.id} kind={citation.kind} />)}</div></details>}</>
  );
}

function CitedPoint({argument}: {argument: Argument}) {
  const {evidenceLabels} = useContext(ChipContext);
  const claim = readableText(argument.claim, evidenceLabels);
  const points = textToKeyPoints(claim);
  // A short leading conclusion may precede supporting metrics after a colon.
  // Use it only when no qualification or currency would be lost.
  const firstPoint = points[0] ?? claim;
  const first = QUALIFIER.test(firstPoint) ? firstPoint : points.find(point => QUALIFIER.test(point)) ?? firstPoint;
  const colon = first.indexOf(':');
  const tail = colon === -1 ? '' : first.slice(colon + 1);
  const lead = colon > 0 && colon < 100 && !QUALIFIER.test(tail) && !MONEY.test(tail)
    ? first.slice(0, colon) : first;
  const amounts = sourceMoney(claim).filter(amount => !pointExcerpt(lead).text.includes(amount));
  return (
    <li className="argument glass-summary-argument">
      <span className="glass-summary-claim"><PointText point={lead} /></span>
      {amounts.length === 0 ? null : <div className="glass-summary-amounts" aria-label="Amounts in the full claim">{amounts.map(amount => <span key={amount}>{amount}</span>)}</div>}
      <Citations argument={argument} />
      <details className="glass-summary-source">
        <summary>Full claim</summary>
        <ul className="glass-key-points glass-summary-full"><li>{claim}</li></ul>
      </details>
    </li>
  );
}

function SourceArguments({arguments: items}: {arguments: Argument[]}) {
  return <ul className="argument-list glass-key-points">{items.map((argument, index) => <CitedPoint key={index} argument={argument} />)}</ul>;
}

export interface CompactAdvocatePanelProps {
  actor: 'rider' | 'driver';
  side: SidePanel;
  status: Run['status'] | null;
}

export function CompactAdvocatePanel({actor, side, status}: CompactAdvocatePanelProps) {
  const advocateCase = side.advocateCase;
  const title = actor === 'rider' ? 'Rider case' : 'Driver case';
  const gathering = status === 'queued' || status === 'running' || status === null;
  return (
    <section className={`panel advocate advocate-${actor} hearing-${actor} glass-summary-panel`} aria-labelledby={`${actor}-advocate-heading`}>
      <h2 id={`${actor}-advocate-heading`} className="advocate-title">{title}</h2>
      {advocateCase === null ? <ul className="glass-key-points"><li>{gathering ? 'Gathering evidence' : 'Case not submitted'}</li></ul> : (
        <>
          <ul className="glass-key-points glass-summary-remedy"><li>{advocateCase.requestedRemedyId === undefined ? 'No remedy requested' : `Requested: ${remedyLabel(advocateCase.requestedRemedyId)}`}</li></ul>
          {advocateCase.arguments.length === 0 ? <KeyPoints text={advocateCase.summary} maxPoints={1} fullTextLabel="Full case" /> : <SourceArguments arguments={advocateCase.arguments.slice(0, 3)} />}
          <details className="glass-summary-source glass-summary-case">
            <summary>Complete case</summary>
            <KeyPoints text={advocateCase.summary} maxPoints={99} showSource={false} compact={false} />
            {advocateCase.arguments.length > 3 ? <SourceArguments arguments={advocateCase.arguments.slice(3)} /> : null}
          </details>
          {advocateCase.counterevidence.length === 0 ? null : (
            <details className="glass-summary-source glass-summary-counter">
              <summary>{`Counterevidence (${advocateCase.counterevidence.length})`}</summary>
              <SourceArguments arguments={advocateCase.counterevidence} />
            </details>
          )}
          {advocateCase.missingFacts.length === 0 ? null : (
            <details className="glass-summary-source glass-summary-missing">
              <summary>{`Missing facts (${advocateCase.missingFacts.length})`}</summary>
              <KeyPoints text={advocateCase.missingFacts} fullTextLabel="Full missing facts" />
            </details>
          )}
        </>
      )}
      <ul className="glass-key-points glass-summary-counts">
        <li>{`Evidence reviewed: ${side.retrievedEvidenceIds.length}`}</li>
        <li>{`Policy checks: ${side.retrievedPolicyIds.length}`}</li>
      </ul>
    </section>
  );
}

export interface CompactJudgePanelProps {
  result: CompletedResult | null;
  status: Run['status'];
  reviewPending?: boolean;
  reviewed?: boolean;
}

export function CompactJudgePanel({result, status, reviewPending = false, reviewed = false}: CompactJudgePanelProps) {
  const waiting = status === 'queued' || status === 'running';
  return (
    <section className="panel judge-panel hearing-judge glass-summary-panel" aria-labelledby="judge-heading">
      <h2 id="judge-heading" className="advocate-title judge-title">Judge findings</h2>
      {reviewPending || reviewed ? <ul className="glass-key-points"><li>{reviewPending ? 'Judge recommendation · Awaiting human review' : 'Original Judge findings · See the verdict for the human decision'}</li></ul> : null}
      {result === null ? <ul className="glass-key-points"><li>{waiting ? 'Waiting for both cases' : 'No final ruling'}</li>{waiting ? null : <li>{status === 'failed' ? 'Hearing ended before a decision' : 'Decisive evidence missing'}</li>}</ul> : (
        <>
          {result.findings.length === 0 ? <ul className="glass-key-points"><li>No findings recorded</li></ul> : <SourceArguments arguments={result.findings.slice(0, 3)} />}
          {result.findings.length <= 3 ? null : <details className="glass-summary-source"><summary>{`More findings (${result.findings.length - 3})`}</summary><SourceArguments arguments={result.findings.slice(3)} /></details>}
          <details className="glass-summary-source glass-summary-reasoning">
            <summary>{reviewPending || reviewed ? 'Judge recommendation rationale' : 'Decision rationale'}</summary>
            <KeyPoints text={result.reasoning} fullTextLabel="Full reasoning" />
          </details>
          <details className="glass-summary-source glass-summary-explanations">
            <summary>Party explanations</summary>
            <KeyPoints text={result.riderExplanation} label="To the rider" fullTextLabel="Full rider explanation" />
            <KeyPoints text={result.driverExplanation} label="To the driver" fullTextLabel="Full driver explanation" />
          </details>
        </>
      )}
    </section>
  );
}
