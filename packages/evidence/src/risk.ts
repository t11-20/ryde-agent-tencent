import { z } from 'zod';
import { RISK_CAVEAT, RiskAssessmentSchema } from '@fairtrip/contracts';
import type { Evidence, RiskAssessment, RiskSeverity, RiskSignal } from '@fairtrip/contracts';

// Deterministic bad-faith/abuse signals from history and chat facts.
// Thresholds live in RISK_PARAMS; the assessment is context only (RISK_CAVEAT).
export const RISK_PARAMS = Object.freeze({
  frequentFilerDisputes90d: 3,
  repeatSubjectMedium90d: 3,
  repeatSubjectHigh90d: 5,
  lowRating: 4.2,
  newAccountDays: 180,
});

const HistoryFacts = z.looseObject({
  kind: z.literal('party_history'),
  party: z.enum(['rider', 'driver']),
  accountAgeDays: z.number(),
  rating: z.number(),
  disputesFiled90d: z.number(),
  disputesAgainst90d: z.number(),
});
const ChatMessageFacts = z.looseObject({
  kind: z.literal('chat_message'),
  sender: z.enum(['rider', 'driver']),
  tags: z.array(z.string()),
});

const SEVERITY_RANK: Record<RiskSeverity, number> = { low: 0, medium: 1, high: 2 };

function partyLabel(party: 'rider' | 'driver'): string {
  return party === 'rider' ? 'Rider' : 'Driver';
}

/** Derive risk signals from the evidence bundle. Never establishes fault. */
export function assessRisk(evidence: Evidence[]): RiskAssessment {
  const signals: RiskSignal[] = [];
  for (const record of evidence) {
    const history = HistoryFacts.safeParse(record.facts);
    if (history.success) {
      const h = history.data;
      const label = partyLabel(h.party);
      if (h.disputesFiled90d >= RISK_PARAMS.frequentFilerDisputes90d)
        signals.push({
          code: 'frequent_filer', party: h.party, severity: 'medium',
          detail: `${label} filed ${h.disputesFiled90d} disputes in the last 90 days.`,
          evidenceIds: [record.id],
        });
      if (h.disputesAgainst90d >= RISK_PARAMS.repeatSubjectMedium90d)
        signals.push({
          code: 'repeat_subject', party: h.party,
          severity: h.disputesAgainst90d >= RISK_PARAMS.repeatSubjectHigh90d ? 'high' : 'medium',
          detail: `${label} had ${h.disputesAgainst90d} disputes filed against them in the last 90 days.`,
          evidenceIds: [record.id],
        });
      if (h.rating < RISK_PARAMS.lowRating)
        signals.push({
          code: 'low_rating', party: h.party, severity: 'medium',
          detail: `${label} rating is ${h.rating}.`,
          evidenceIds: [record.id],
        });
      if (h.accountAgeDays < RISK_PARAMS.newAccountDays)
        signals.push({
          code: 'new_account', party: h.party, severity: 'low',
          detail: `${label} account is ${h.accountAgeDays} days old.`,
          evidenceIds: [record.id],
        });
      continue;
    }
    const message = ChatMessageFacts.safeParse(record.facts);
    if (message.success) {
      const m = message.data;
      if (m.tags.includes('instruction_like'))
        signals.push({
          code: 'instruction_like_chat', party: m.sender, severity: 'high',
          detail: `${partyLabel(m.sender)} chat contains instruction-like text aimed at the model.`,
          evidenceIds: [record.id],
        });
      if (m.tags.includes('threat'))
        signals.push({
          code: 'threat_in_chat', party: m.sender, severity: 'medium',
          detail: `${partyLabel(m.sender)} chat contains a threat.`,
          evidenceIds: [record.id],
        });
    }
  }

  const overall = signals.reduce<RiskSeverity>(
    (max, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[max] ? s.severity : max),
    'low',
  );
  const parties: Array<'rider' | 'driver'> = ['rider', 'driver'];
  const summary = signals.length === 0
    ? 'No risk signals in the retrieved history or chat records.'
    : parties
        .map(party => {
          const codes = signals.filter(s => s.party === party).map(s => s.code);
          return codes.length === 0 ? null : `${partyLabel(party)} signals: ${codes.join(', ')}.`;
        })
        .filter((line): line is string => line !== null)
        .join(' ');

  return RiskAssessmentSchema.parse({
    overall, signals, summary, caveat: RISK_CAVEAT, source: 'deterministic',
  });
}
