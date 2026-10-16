import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActivityEvent, PolicyClause, Run } from '@fairtrip/contracts';
import { ChipContext } from '../components/Chip.js';
import type { PollPhase } from '../hooks/useRunPolling.js';
import { formatSgd, percent, remedyLabel, rulingLabel } from '../lib/format.js';
import { actionHeadline, categoryLabel, clauseLabel, divergenceComparison, escalationLines, evidenceLabel, formatCount, partitionClauses, remedyOptions } from '../lib/present.js';
import type { RemedyOption } from '../lib/present.js';
import { buildViewModel } from '../lib/view-model.js';
import type { EvidenceCard, Family, SidePanel } from '../lib/view-model.js';
import { CompactAdvocatePanel, CompactJudgePanel, KeyPoints } from './KeyPoints.js';
import { CompactRiskPanel } from './RiskSummary.js';
import { reviewActions } from './review-actions.js';
import { LiquidHearingLines } from './LiquidHearingLines.js';
import { HearingSymbol } from './HearingSymbol.js';

const FAMILIES: Family[] = ['gps', 'chat', 'payment', 'history'];
const EMPTY_SIDE: SidePanel = {toolRequests: [], retrievedEvidenceIds: [], retrievedPolicyIds: [], advocateCase: null};
const FAMILY_LABELS: Record<Family, string> = {gps: 'Trip', chat: 'Conversation', payment: 'Payment', history: 'History'};
const SCENARIO_LABELS: Record<string, string> = {
  R1: 'Unapproved detour', R1S: 'Detour with surge and promotion',
  R2: 'Longer route approved by the rider', R3: 'Road closure diversion', X1: 'Missing route evidence',
  N1: 'Driver too far from pickup', N2: 'Pickup and waiting conditions met', N2H: 'Pickup with different party histories',
  N3: 'Driver cancelled too early', X2: 'Pickup with an unusual chat message', X3: 'Missing payment evidence',
  R4: 'Small detour within the policy threshold', R1F: 'Detour with a flagged rider history',
  X4: 'Missing payment evidence on a route dispute', N1R: 'Flagged rider, driver never arrived',
  N4: 'Driver waited but never contacted the rider', N5: 'Threatening chat, pickup conditions met',
  N6: 'Pickup conditions met at the minimum', X5: 'Missing route evidence on a no-show',
  X6: 'Driver message tries to instruct the Judge',
};

export interface CaseOption {id: string; label: string; category: 'route_deviation' | 'no_show'}
interface CaseSegmentProps {
  options: CaseOption[]; selectedId: string; onSelect: (id: string) => void;
  claim: string; statement: string; sourceLabel: string;
  onAction: () => void; actionLabel: string; busy?: boolean; actionDisabled?: boolean;
  actionBusy?: boolean; actionStatus?: string;
  onClaimChange?: (value: string) => void;
}

export function CaseSegment({options, selectedId, onSelect, claim, statement, sourceLabel, onAction, actionLabel, busy = false, actionDisabled = false, actionBusy = busy, actionStatus, onClaimChange}: CaseSegmentProps) {
  const id = useId();
  const selected = options.find(option => option.id === selectedId);
  return (
    <section className="panel casebar glass-case-segment" aria-labelledby={`${id}-heading`}>
      <div className="glass-section-heading"><h2 id={`${id}-heading`} className="panel-title">Case</h2><span className="glass-case-source">{sourceLabel}</span></div>
      <div className="glass-scenario-row">
        <div className="glass-scenario-field"><label htmlFor={`${id}-scenario`}>Scenario</label><select id={`${id}-scenario`} className="casebar-select" value={selectedId} disabled={busy || options.length === 0} onChange={event => { onSelect(event.target.value); }}>
          {options.length === 0 ? <option value="">Waiting for available cases</option> : options.map(option => <option key={option.id} value={option.id}>{SCENARIO_LABELS[option.id] ?? option.label}</option>)}
        </select></div>
        <button type="button" className="btn-primary glass-hearing-action" disabled={busy || actionBusy || actionDisabled || selectedId === ''} aria-busy={actionBusy} onClick={onAction}>{actionBusy ? <svg className="glass-action-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="glass-action-spinner-track" cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 9 9" /></svg> : null}<span>{actionLabel}</span></button>
      </div>
      {actionStatus === undefined || actionStatus === '' ? null : <p className="glass-action-status" role="status" aria-live="polite" aria-atomic="true">{actionStatus}</p>}
      {selected === undefined ? null : <span className="casebar-category">{categoryLabel(selected.category)}</span>}
      <div className="casebar-claims">
        <div className="casebar-claim glass-claim-rider"><h3 className="casebar-claim-label">Rider claim</h3><KeyPoints text={claim || 'Choose a case to view the rider’s claim.'} maxPoints={2} fullTextLabel="Full claim" />{onClaimChange === undefined ? null : <details className="glass-case-editor"><summary>Edit claim</summary><textarea className="casebar-textarea" value={claim} disabled={busy} rows={3} aria-label="Edit rider claim" onChange={event => { onClaimChange(event.target.value); }} /></details>}</div>
        <div className="casebar-claim glass-claim-driver"><h3 className="casebar-claim-label">Driver response</h3><KeyPoints text={statement || 'Choose a case to view the driver’s response.'} maxPoints={2} fullTextLabel="Full response" /></div>
      </div>
    </section>
  );
}

/** Human-review actions wired to the connected API; undefined for offline playback. */
export interface ReviewControls {
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onOverride: (remedyId: RemedyOption['id'], note: string) => void;
}

function OverrideForm({options, defaultId, busy, onApply, onCancel}: {
  options: RemedyOption[];
  defaultId: RemedyOption['id'];
  busy: boolean;
  onApply: (remedyId: RemedyOption['id'], note: string) => void;
  onCancel: () => void;
}) {
  const [remedyId, setRemedyId] = useState<RemedyOption['id']>(defaultId);
  const [note, setNote] = useState('');
  return (
    <div className="review-form glass-review-form">
      <div className="review-field">
        <label className="review-label" htmlFor="glass-review-remedy">Replacement remedy</label>
        <select id="glass-review-remedy" className="casebar-select" value={remedyId} disabled={busy} onChange={event => { setRemedyId(event.target.value as RemedyOption['id']); }}>
          {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </div>
      <div className="review-field">
        <label className="review-label" htmlFor="glass-review-note">Reviewer note (optional)</label>
        <textarea id="glass-review-note" className="casebar-textarea" rows={3} maxLength={2000} value={note} disabled={busy} onChange={event => { setNote(event.target.value); }} />
      </div>
      <div className="glass-review-buttons">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => { onApply(remedyId, note); }}>Apply override</button>
        <button type="button" className="btn-text" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function VerdictSegment({run, phase, illustrative = false, note, review}: {run: Run | null; phase: PollPhase; problem: string | null; illustrative?: boolean; note?: string | null; review?: ReviewControls}) {
  const completed = run?.status === 'completed' ? run : null;
  const humanReview = completed?.review;
  const reviewPending = completed?.escalation !== undefined && humanReview === undefined;
  const actions = reviewActions(run);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const runId = completed === null ? null : completed.id;
  useEffect(() => { setOverrideOpen(false); }, [runId, reviewPending]);
  const divergence = completed === null ? null : divergenceComparison(completed);
  const result = completed === null ? null : humanReview !== undefined
    ? {...completed.result, ruling: humanReview.ruling, remedyId: humanReview.action.remedyId, action: humanReview.action}
    : completed.result.ruling !== 'incomplete' ? completed.result : null;
  const incomplete = run?.status === 'incomplete' || (completed?.result.ruling === 'incomplete' && humanReview === undefined);
  const exampleOnly = completed?.mode === 'stub' && completed.result.ruling === 'incomplete' && humanReview === undefined;
  const failed = run?.status === 'failed' || phase === 'start_failed' || phase === 'contract_mismatch' || phase === 'connection_lost';
  const state = reviewPending ? 'incomplete' : result !== null ? result.ruling : incomplete ? 'incomplete' : failed ? 'failed' : 'pending';
  return (
    <section className="panel glass-verdict" data-verdict={state} aria-labelledby="glass-verdict-heading" aria-live="polite">
      <div className="glass-section-heading"><h2 id="glass-verdict-heading" className="glass-verdict-label">Verdict</h2><span className="glass-verdict-status">{reviewPending ? 'Human review' : result !== null ? 'Final decision' : exampleOnly ? 'Example only' : incomplete ? 'Human review' : failed ? 'No decision' : 'Awaiting decision'}</span></div>
      {note === undefined || note === null || note === '' ? null : <p className="glass-action-status" role="status">{note}</p>}
      <div className="glass-verdict-body">
        <div className="glass-verdict-seal" data-seal={reviewPending ? 'review' : result !== null ? 'complete' : incomplete ? 'review' : failed ? 'failed' : 'pending'} aria-hidden="true">
          <svg viewBox="0 0 96 96" fill="none">
            <rect className="glass-seal-edge" x="8" y="5" width="80" height="80" rx="25" />
            <rect className="glass-seal-face" x="18" y="15" width="60" height="60" rx="19" />
            <g transform="translate(24 21) scale(2)"><HearingSymbol name={result !== null && !reviewPending ? 'decision' : 'review'} /></g>
          </svg>
          <span>{reviewPending ? 'Review' : result !== null ? 'Decision' : incomplete ? 'Review' : failed ? 'Unavailable' : 'Pending'}</span>
        </div>
      {result !== null ? (
        <>
        <div className="glass-verdict-grid">
          <div><p className="glass-verdict-title">{reviewPending ? 'Judge recommendation' : rulingLabel(result.ruling)}</p><ul className="glass-key-points">{reviewPending ? <li>{rulingLabel(result.ruling)}</li> : null}<li>{remedyLabel(result.remedyId)}</li><li>{`${illustrative ? 'Illustrative confidence' : 'AI-assessed confidence'}: ${percent(result.confidence)}`}</li>{humanReview === undefined ? null : <li>{humanReview.decision === 'confirmed' ? 'Confirmed by a human reviewer' : 'Overridden by a human reviewer'}</li>}</ul>{humanReview === undefined || humanReview.note.trim() === '' ? null : <KeyPoints text={humanReview.note} maxPoints={2} fullTextLabel="Reviewer note" />}</div>
          <div className="glass-verdict-action">{reviewPending ? <span>Proposed amount</span> : null}<span className="glass-verdict-amount">{formatSgd(result.action.amountCents)}</span><ul className="glass-key-points"><li>{`${reviewPending ? 'Proposed: ' : ''}${actionHeadline(result.action)}`}</li><li>{reviewPending ? 'No payment amount issued · Awaiting a human reviewer' : 'Based on the recorded fare'}</li></ul></div>
        </div>
        {reviewPending && completed !== null ? (
          <div className="glass-verdict-review">
            <ul className="glass-key-points glass-escalation-lines">
              {escalationLines(completed).map(line => <li key={line}>{line}</li>)}
              {divergence === null ? null : <li>{divergence.policy}</li>}
              {divergence === null ? null : <li>{divergence.judge}</li>}
            </ul>
            {review === undefined ? (
              <ul className="glass-key-points"><li>Reviewer actions are available in a connected hearing</li></ul>
            ) : (
              <div className="glass-review-actions">
                <div className="glass-review-buttons">
                  {actions.confirm ? <button type="button" className="btn-primary" disabled={review.busy} onClick={review.onConfirm}>Confirm ruling</button> : null}
                  {actions.override ? <button type="button" className="btn-secondary" disabled={review.busy} aria-expanded={overrideOpen} onClick={() => { setOverrideOpen(value => !value); }}>Override…</button> : null}
                  {actions.applyVerdictId === null ? null : <button type="button" className="btn-secondary" disabled={review.busy} onClick={() => { if (actions.applyVerdictId !== null) review.onOverride(actions.applyVerdictId, 'Applied the deterministic policy verdict.'); }}>Apply policy verdict</button>}
                  {review.busy ? <span className="glass-verdict-meta">Saving…</span> : null}
                </div>
                {review.error === null ? null : <p className="glass-action-status" role="alert">{review.error}</p>}
                {overrideOpen ? (
                  <OverrideForm
                    options={remedyOptions(completed.dispute.category)}
                    defaultId={remedyOptions(completed.dispute.category).find(option => option.id !== completed.result.action.remedyId)?.id ?? 'keep_charge'}
                    busy={review.busy}
                    onApply={review.onOverride}
                    onCancel={() => { setOverrideOpen(false); }}
                  />
                ) : null}
              </div>
            )}
          </div>
        ) : null}
        </>
      ) : (
        <div className="glass-verdict-grid"><div><p className="glass-verdict-title">{exampleOnly ? 'Example hearing' : incomplete ? 'No final ruling' : failed ? 'Decision unavailable' : phase === 'stopped' ? 'Updates paused' : run === null ? 'Ready when you are' : 'Hearing in progress'}</p><ul className="glass-key-points"><li>{exampleOnly ? 'This example does not issue a final decision' : run?.status === 'incomplete' ? 'Decisive evidence is missing' : incomplete ? 'No final decision was issued' : failed ? 'Try the hearing again or choose another case' : run === null ? 'Choose a scenario to begin' : 'A verdict appears after the Judge rules'}</li><li>No payment amount issued</li></ul></div><div>{run?.status === 'incomplete' ? <KeyPoints text={run.missingEvidence} maxPoints={2} fullTextLabel="Missing evidence" /> : null}{failed ? <ul className="glass-key-points"><li>{phase === 'connection_lost' ? 'The connection was interrupted. You can keep waiting for the hearing.' : 'The hearing could not be completed. Please try again.'}</li></ul> : null}</div></div>
      )}</div>
    </section>
  );
}

function numberFact(card: EvidenceCard, key: string): number | null {
  const value = card.facts[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function countFact(card: EvidenceCard, key: string): number {
  const value = card.facts[key];
  return Array.isArray(value) ? value.length : 0;
}
function stringFact(card: EvidenceCard, key: string): string | null {
  const value = card.facts[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Compact labels read server-computed facts; no evidence is recalculated here. */
export function evidencePoints(card: EvidenceCard): string[] {
  if (card.kind === 'chat_message' && card.text !== null) return [card.text];
  if (card.kind === 'nav_event') return [stringFact(card, 'detail') ?? card.summary];
  if (card.kind === 'traffic_advisory') return [stringFact(card, 'description') ?? card.summary, 'Traffic advisory for this demonstration'];
  if (card.kind === 'route_metrics') {
    const reference = numberFact(card, 'referenceMeters'); const actual = numberFact(card, 'actualMeters');
    const threshold = card.facts['exceedsThreshold'];
    return [reference === null || actual === null ? card.summary : `Trip: ${formatCount(actual)} m · Reference route: ${formatCount(reference)} m`, `Detour check: ${threshold === true ? 'above the policy threshold' : threshold === false ? 'within the policy threshold' : 'not available'}`];
  }
  if (card.kind === 'pickup_metrics') {
    const approach = numberFact(card, 'closestApproachMeters'); const wait = numberFact(card, 'waitSecondsWithinThreshold');
    return [approach === null ? 'Pickup approach unavailable' : `Closest approach: ${formatCount(approach)} m`, wait === null ? 'No wait within pickup range' : `Wait within range: ${formatCount(wait)} s`];
  }
  if (card.kind === 'chat_summary') {
    const messages = numberFact(card, 'messageCount'); const contacts = numberFact(card, 'driverContactAttemptsBeforeCancel');
    return [contacts === null ? `Rider approvals: ${countFact(card, 'riderAgreementIds')} · Objections: ${countFact(card, 'riderObjectionIds')}` : `Driver contact attempts: ${formatCount(contacts)}`, messages === null ? 'Messages unavailable' : `Messages: ${formatCount(messages)}`];
  }
  if (card.kind === 'fare_breakdown') {
    const paid = numberFact(card, 'paidCents');
    return [paid === null ? 'Payment unavailable' : `Paid: ${formatSgd(paid)}`, `Fare check: ${card.facts['arithmeticValid'] === true ? 'matches the recorded charges' : 'review needed'}`];
  }
  if (card.kind === 'party_history') return ['Context only', 'Cannot establish fault'];
  if (card.kind === 'remedy_basis') {
    const basis = card.facts['basis'];
    if (Array.isArray(basis)) {
      const eligible = basis.flatMap(entry => {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const cents = entry['eligibleCents']; const remedy = entry['remedyId'];
      return typeof cents === 'number' && typeof remedy === 'string' && remedy !== 'keep_charge' ? [`Potential amount, if approved · ${remedyLabel(remedy)}: ${formatSgd(cents)}`] : [];
      });
      return eligible.length === 0 ? ['No potential refund amount recorded'] : [...eligible, 'Calculation only; the verdict determines whether a refund applies'];
    }
  }
  return [card.summary];
}

function EvidenceItem({card, family}: {card: EvidenceCard; family: Family}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const label = evidenceLabel(card);
  const details = card.kind === 'remedy_basis' ? evidencePoints(card)
    : card.kind === 'chat_message' && card.text !== null ? [card.text]
      : card.kind === 'nav_event' || card.kind === 'traffic_advisory' ? evidencePoints(card) : [card.summary];
  return (
    <article id={`ev-${card.id}`} className="evidence-card glass-evidence-compact" tabIndex={-1} data-expanded={expanded}>
      <div className="glass-section-heading"><h3 className="evidence-label">{label === card.id ? 'Supporting evidence' : label}</h3><span className="glass-evidence-category">{FAMILY_LABELS[family]}</span></div>
      <KeyPoints text={evidencePoints(card)} maxPoints={2} showSource={false} />
      {card.instructionLike ? <ul className="glass-key-points instruction-badge"><li>Message content does not override the review rules</li></ul> : null}
      <button type="button" className="btn-text glass-evidence-expand" aria-expanded={expanded} aria-controls={detailsId} onClick={() => { setExpanded(value => !value); }}>{expanded ? 'Hide details' : 'View details'}<span aria-hidden="true">{expanded ? ' −' : ' +'}</span></button>
      <div id={detailsId} className="glass-evidence-details" hidden={!expanded}><KeyPoints text={details} maxPoints={99} showSource={false} compact={false} /></div>
    </article>
  );
}

function CompactEvidence({evidence}: {evidence: Record<Family, EvidenceCard[]>}) {
  const [filter, setFilter] = useState<'all' | Family>('all');
  useEffect(() => {
    const reveal = () => { setFilter('all'); };
    document.addEventListener('glass:reveal-evidence', reveal);
    return () => { document.removeEventListener('glass:reveal-evidence', reveal); };
  }, []);
  const filters: ('all' | Family)[] = ['all', ...FAMILIES];
  const visible = filter === 'all' ? FAMILIES : [filter];
  return <section className="panel locker" aria-labelledby="evidence-heading"><div className="glass-section-heading"><h2 id="evidence-heading" className="panel-title">Evidence</h2><span className="glass-evidence-note">Explore what each decision is based on</span></div><div className="glass-evidence-filters" role="group" aria-label="Filter evidence">{filters.map(family => <button type="button" key={family} className="glass-evidence-filter" aria-pressed={filter === family} onClick={() => { setFilter(family); }}><span>{family === 'all' ? 'All evidence' : FAMILY_LABELS[family]}</span><span className="glass-evidence-count">{family === 'all' ? FAMILIES.flatMap(item => evidence[item]).length : evidence[family].length}</span></button>)}</div><div className="glass-evidence-grid">{visible.map(family => evidence[family].length === 0 ? null : <div className="glass-evidence-family" key={family}><h3 className="evidence-group-heading"><EvidenceSymbol family={family} />{FAMILY_LABELS[family]}</h3>{evidence[family].map(card => <EvidenceItem key={card.id} card={card} family={family} />)}</div>)}</div>{visible.every(family => evidence[family].length === 0) ? <ul className="glass-key-points"><li>{filter === 'all' ? 'Evidence appears as the hearing progresses' : 'No evidence in this category yet'}</li></ul> : null}</section>;
}

function EvidenceSymbol({family}: {family: Family}) {
  return <span className="glass-evidence-symbol" aria-hidden="true"><HearingSymbol name={family === 'gps' ? 'trip' : family === 'chat' ? 'conversation' : family} /></span>;
}

function PolicyItem({clause}: {clause: PolicyClause}) {
  const label = clauseLabel(clause.id);
  return <li id={`pol-${clause.id}`} className="policy-clause" tabIndex={-1}><h3 className="policy-heading">{label === clause.id ? 'Review rule' : label}</h3><KeyPoints text={clause.remedyCriteria} maxPoints={1} showSource={false} /><details className="glass-summary-source"><summary>View rule</summary><KeyPoints text={clause.ruleText.replace(/^DEMONSTRATION POLICY\.\s*/, '')} maxPoints={99} showSource={false} compact={false} /></details></li>;
}

function CompactPolicy({policies, citedIds}: {policies: PolicyClause[]; citedIds: string[]}) {
  if (policies.length === 0) return null;
  const {cited, rest} = partitionClauses(policies, citedIds);
  return <section className="panel policy" aria-labelledby="policy-heading"><div className="glass-section-heading"><h2 id="policy-heading" className="panel-title">Policy</h2><span className="policy-note">Demonstration policy</span></div><ul className="policy-list">{(cited.length === 0 ? rest : cited).map(clause => <PolicyItem key={clause.id} clause={clause} />)}</ul>{cited.length === 0 || rest.length === 0 ? null : <details className="policy-more"><summary>{rest.length} more clauses</summary><ul className="policy-list">{rest.map(clause => <PolicyItem key={clause.id} clause={clause} />)}</ul></details>}</section>;
}

export function HearingBoard({run, events, caseContent, phase, problem, controls, illustrative = false, replayProgress, progressMode = 'live', note, review, footer}: {run: Run | null; events: ActivityEvent[]; caseContent: ReactNode; phase: PollPhase; problem: string | null; controls?: ReactNode; illustrative?: boolean; replayProgress?: number; progressMode?: 'replay' | 'live'; note?: string | null; review?: ReviewControls; footer?: ReactNode}) {
  const vm = useMemo(() => run === null ? null : buildViewModel(run, events), [run, events]);
  const reviewPending = run?.status === 'completed' && run.escalation !== undefined && run.review === undefined;
  const reviewed = run?.status === 'completed' && run.review !== undefined;
  const reviewedResult = run?.status === 'completed' && run.review !== undefined && vm?.result !== null && vm?.result !== undefined
    ? {...vm.result, ruling: run.review.ruling, remedyId: run.review.action.remedyId, action: run.review.action, reasoning: run.review.note.trim() || 'A human reviewer made the final decision.'}
    : vm?.result ?? null;
  const context = useMemo(() => {
    const evidenceLabels = new Map<string, string>();
    if (vm !== null) for (const family of FAMILIES) for (const card of vm.evidence[family]) { const label = evidenceLabel(card); evidenceLabels.set(card.id, label === card.id ? 'Supporting evidence' : label); }
    return {knownIds: vm?.knownIds ?? new Set<string>(), evidenceLabels};
  }, [vm]);
  const citedIds = vm?.result?.findings.flatMap(finding => finding.policyClauseIds) ?? [];
  return <ChipContext.Provider value={context}><main className="app glass-recorded glass-concise">
    {caseContent}
    <VerdictSegment run={run} phase={phase} problem={problem} illustrative={illustrative} note={note} {...(review === undefined ? {} : {review})} />
    {controls}
    <LiquidHearingLines events={events} status={run?.status ?? null} result={reviewedResult} cases={run?.cases ?? []} phase={phase} progressMode={progressMode} reviewPending={reviewPending} {...(run?.risk === undefined ? {} : {risk: run.risk})} precedents={run?.precedents ?? []} {...(replayProgress === undefined ? {} : {replayProgress})} />
    <div className="hearing"><CompactAdvocatePanel actor="rider" side={vm?.rider ?? EMPTY_SIDE} status={run?.status ?? null} /><CompactJudgePanel result={vm?.result ?? null} status={run?.status ?? 'queued'} reviewPending={reviewPending} reviewed={reviewed} {...(run?.verdict === undefined ? {} : {verdict: run.verdict})} precedents={run?.precedents ?? []} precedentsSeen={events.some(event => event.type === 'precedent.retrieved')} /><CompactAdvocatePanel actor="driver" side={vm?.driver ?? EMPTY_SIDE} status={run?.status ?? null} /></div>
    <CompactRiskPanel risk={run?.risk} />
    {vm === null ? null : <><CompactEvidence evidence={vm.evidence} /><CompactPolicy policies={vm.policies} citedIds={citedIds} /></>}
    {footer}
  </main></ChipContext.Provider>;
}
