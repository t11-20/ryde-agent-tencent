import { useEffect, useMemo, useState } from 'react';
import type { Run } from '@fairtrip/contracts';
import { CaseSegment, HearingBoard } from './HearingPresentation.js';
import { demoScenarios } from './demo-data.js';
export { demoScenarios } from './demo-data.js';

const initialScenario = (() => {
  const first = demoScenarios[0];
  if (first === undefined) throw new Error('No demo scenarios');
  return first;
})();

/** Split presentation into sentences without paraphrasing the recorded claims. */
export function claimPoints(text: string): string[] {
  if (text.trim() === '') return [];
  if (typeof Intl.Segmenter === 'undefined') return [text.trim()];
  const segments = new Intl.Segmenter('en', {granularity: 'sentence'}).segment(text);
  return [...segments].map(segment => segment.segment.trim()).filter(Boolean);
}

/** Reveal only records and cases already present at this point in the recording. */
export function recordedFrame(count: number, source: Run = initialScenario.run): Run {
  if (count >= source.events.length) return source;
  const events = source.events.slice(0, Math.max(0, count));
  const evidenceIds = new Set(events.filter(event => event.type === 'evidence.retrieved').flatMap(event => event.evidenceIds));
  const policyIds = new Set(events.filter(event => event.type === 'policy.retrieved').flatMap(event => event.policyClauseIds));
  return {
    id: source.id, fixtureId: source.fixtureId, mode: source.mode,
    dispute: source.dispute, status: 'running', events,
    cases: source.cases.filter(advocateCase => events.some(event => event.actor === advocateCase.side && event.type === 'case.completed')),
    retrievedEvidence: source.retrievedEvidence.filter(record => evidenceIds.has(record.id)),
    retrievedPolicies: source.retrievedPolicies.filter(clause => policyIds.has(clause.id)),
  };
}

export function RecordedHearing() {
  const [selectedId, setSelectedId] = useState(initialScenario.id);
  const selected = demoScenarios.find(scenario => scenario.id === selectedId) ?? initialScenario;
  const [count, setCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const run = useMemo(() => recordedFrame(count, selected.run), [count, selected]);
  const terminal = ['completed', 'incomplete', 'failed'].includes(run.status);
  const replaying = playing && !terminal;
  const replayProgress = selected.run.events.length === 0 ? 100 : Math.min(100, Math.max(0, Math.round(count / selected.run.events.length * 100)));

  useEffect(() => {
    if (!playing) return;
    if (count >= selected.run.events.length) { setPlaying(false); return; }
    const timer = window.setTimeout(() => { setCount(value => value + 1); }, 650);
    return () => { window.clearTimeout(timer); };
  }, [count, playing, selected]);
  const replay = () => { setCount(0); setPlaying(true); };
  const choose = (id: string) => {
    const next = demoScenarios.find(scenario => scenario.id === id);
    if (next === undefined) return;
    setPlaying(true); setSelectedId(id); setCount(0);
  };
  return <HearingBoard run={run} events={run.events} phase={terminal ? 'done' : replaying ? 'polling' : 'stopped'} problem={null} illustrative={selected.provenance === 'scripted-demo'} progressMode="replay" replayProgress={replayProgress}
    caseContent={<CaseSegment options={demoScenarios} selectedId={selectedId} onSelect={choose} claim={run.dispute.riderClaim} statement={run.dispute.driverStatement} sourceLabel={`${selected.provenance === 'recorded-live' ? 'Recorded case review' : 'Illustrative case review'} · Synthetic data`} onAction={terminal ? replay : () => { setPlaying(true); }} actionLabel={replaying ? 'Viewing case review…' : terminal ? 'View case review' : 'Continue review'} actionBusy={replaying} actionStatus={replaying ? `Viewing saved case review · ${replayProgress}%` : terminal ? 'Case review finished. View it again or choose another case.' : `Case review paused at ${replayProgress}%`} />}
    controls={terminal ? null : <div className="glass-hearing-controls">{replaying ? <button type="button" className="btn-secondary" onClick={() => { setPlaying(false); }}>Pause review</button> : null}<button type="button" className="btn-text" onClick={() => { setPlaying(false); setCount(selected.run.events.length); }}>Skip to outcome</button></div>} />;
}
