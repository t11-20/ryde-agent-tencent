import type { ActivityEvent, AdvocateCase, Evidence, PolicyClause, Run } from '@fairtrip/contracts';

export type Family = Evidence['source'];
export type CompletedResult = Extract<Run, {status: 'completed'}>['result'];

export interface SidePanel { toolRequests: string[]; retrievedEvidenceIds: string[]; retrievedPolicyIds: string[]; advocateCase: AdvocateCase | null }
export interface EvidenceCard {
  id: string; source: Family; kind: string; summary: string; text: string | null; tags: string[];
  instructionLike: boolean; retrievedBy: ('rider' | 'driver')[]; timestamp: string; facts: Evidence['facts'];
}
export interface ViewModel {
  status: Run['status']; showAction: boolean; result: CompletedResult | null; missingEvidence: string[];
  error: {code: string; message: string} | null; rider: SidePanel; driver: SidePanel;
  evidence: Record<Family, EvidenceCard[]>; policies: PolicyClause[]; knownIds: Set<string>; handoffSequence: number | null;
}

function buildSidePanel(actor: 'rider' | 'driver', events: ActivityEvent[], cases: AdvocateCase[]): SidePanel {
  const toolRequests: string[] = [];
  const retrievedEvidenceIds: string[] = [];
  const retrievedPolicyIds: string[] = [];
  for (const event of events) {
    if (event.actor !== actor) continue;
    if (event.type === 'tool.requested') toolRequests.push(event.summary);
    if (event.type === 'evidence.retrieved') {
      for (const id of event.evidenceIds) if (!retrievedEvidenceIds.includes(id)) retrievedEvidenceIds.push(id);
    }
    if (event.type === 'policy.retrieved') {
      for (const id of event.policyClauseIds) if (!retrievedPolicyIds.includes(id)) retrievedPolicyIds.push(id);
    }
  }
  return {toolRequests, retrievedEvidenceIds, retrievedPolicyIds, advocateCase: cases.find(c => c.side === actor) ?? null};
}

function retrievedByMap(events: ActivityEvent[]): Map<string, ('rider' | 'driver')[]> {
  const map = new Map<string, ('rider' | 'driver')[]>();
  for (const event of events) {
    if (event.type !== 'evidence.retrieved') continue;
    if (event.actor !== 'rider' && event.actor !== 'driver') continue;
    for (const id of event.evidenceIds) {
      const actors = map.get(id) ?? [];
      if (!actors.includes(event.actor)) actors.push(event.actor);
      map.set(id, actors);
    }
  }
  return map;
}

function buildEvidenceCard(evidence: Evidence, byId: Map<string, ('rider' | 'driver')[]>): EvidenceCard {
  const kind = evidence.facts['kind'];
  const summary = evidence.facts['summary'];
  const text = evidence.facts['text'];
  const rawTags = evidence.facts['tags'];
  const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === 'string') : [];
  return {
    id: evidence.id, source: evidence.source,
    kind: typeof kind === 'string' ? kind : '',
    summary: typeof summary === 'string' ? summary : '',
    text: typeof text === 'string' ? text : null,
    tags, instructionLike: tags.includes('instruction_like'),
    retrievedBy: byId.get(evidence.id) ?? [],
    timestamp: evidence.timestamp, facts: evidence.facts
  };
}

export function buildViewModel(run: Run, events: ActivityEvent[]): ViewModel {
  const evidence: Record<Family, EvidenceCard[]> = {gps: [], chat: [], payment: [], history: []};
  const byId = retrievedByMap(events);
  for (const record of run.retrievedEvidence) evidence[record.source].push(buildEvidenceCard(record, byId));

  const knownIds = new Set<string>([
    ...run.retrievedEvidence.map(record => record.id),
    ...run.retrievedPolicies.map(policy => policy.id)
  ]);
  const handoff = events.find(event => event.type === 'judge.started');

  return {
    status: run.status,
    showAction: run.status === 'completed',
    result: run.status === 'completed' ? run.result : null,
    missingEvidence: run.status === 'incomplete' ? run.missingEvidence : [],
    error: run.status === 'failed' ? run.error : null,
    rider: buildSidePanel('rider', events, run.cases),
    driver: buildSidePanel('driver', events, run.cases),
    evidence,
    policies: run.retrievedPolicies,
    knownIds,
    handoffSequence: handoff ? handoff.sequence : null
  };
}
