import type { Fixture, PolicyParams } from './schemas.js';
import { toEpochSeconds } from './time.js';

export type ChatTag = 'agreement' | 'route_request' | 'objection' | 'threat' | 'instruction_like' | 'location_claim';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface AnalysedMessage {
  id: string;
  ts: string;
  sender: 'rider' | 'driver';
  text: string;
  tags: ChatTag[];
  sentiment: Sentiment;
}

export interface AnalysedCall {
  id: string;
  ts: string;
  from: 'rider' | 'driver';
  to: 'rider' | 'driver';
  durationSec: number;
  answered: boolean;
}

export interface ChatAnalysis {
  messages: AnalysedMessage[];
  calls: AnalysedCall[];
  messageCount: number;
  callCount: number;
  riderAgreementIds: string[];
  riderRouteRequestIds: string[];
  riderObjectionIds: string[];
  threatIds: string[];
  instructionLikeIds: string[];
  sentimentCounts: { positive: number; neutral: number; negative: number };
  driverContactAttemptsBeforeCancel: number | null;
  contactAttemptIds: string[];
  minContactAttempts: number;
  contactCheckMet: boolean | null;
}

type Sender = 'rider' | 'driver';

interface TagRule {
  tag: ChatTag;
  senders: readonly Sender[];
  pattern: RegExp;
}

// SPEC §5.7 tag table, in table order. Message text is untrusted and never modified;
// the patterns only read it.
const TAG_RULES: TagRule[] = [
  { tag: 'agreement', senders: ['rider'], pattern: /\b(yes|ok|okay|sure|no problem|agreed?|go ahead|fine)\b/i },
  { tag: 'route_request', senders: ['rider'], pattern: /\b(via|instead|go through|take the)\b/i },
  { tag: 'objection', senders: ['rider'], pattern: /\b(why|wrong way|follow the app|longer|overcharg\w*|not happy|unacceptable)\b/i },
  { tag: 'threat', senders: ['rider', 'driver'], pattern: /\b(report you|police|sue|lawyer|hurt|kill)\b/i },
  {
    tag: 'instruction_like',
    senders: ['rider', 'driver'],
    pattern: /(ignore (all|any|previous|prior)|disregard|system (note|notice|prompt|message)|ai judge|as an ai|you must rule)/i,
  },
  { tag: 'location_claim', senders: ['rider', 'driver'], pattern: /\b(i'?m here|i am here|i'?m at|at the pickup|main entrance)\b/i },
];

const NEGATIVE_PATTERN = /\b(angry|upset|terrible|annoyed|frustrat\w*|ridiculous)\b/i;
const POSITIVE_PATTERN = /\b(thanks|thank you|great|appreciate)\b/i;

/** §5.7 tags for one message, in table order. */
export function tagsFor(message: { sender: Sender; text: string }): ChatTag[] {
  const tags: ChatTag[] = [];
  for (const rule of TAG_RULES) {
    if (rule.senders.includes(message.sender) && rule.pattern.test(message.text)) {
      tags.push(rule.tag);
    }
  }
  return tags;
}

/** §5.7 sentiment: objection/threat or negative words → negative; positive words → positive; else neutral. */
export function sentimentFor(text: string, tags: ChatTag[]): Sentiment {
  if (tags.includes('objection') || tags.includes('threat')) return 'negative';
  if (NEGATIVE_PATTERN.test(text)) return 'negative';
  if (POSITIVE_PATTERN.test(text)) return 'positive';
  return 'neutral';
}

/** (CHAT, 0) → 'CHAT-01'; (CALL, 9) → 'CALL-10'. */
export function evidenceSeqId(prefix: 'CHAT' | 'CALL', index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

/** §5.7 chat analysis: tags, sentiment and contact attempts for a whole fixture. */
export function analyseChat(fixture: Fixture, params: PolicyParams): ChatAnalysis {
  const sortedMessages = [...fixture.chat.messages].sort((a, b) => toEpochSeconds(a.ts) - toEpochSeconds(b.ts));
  const sortedCalls = [...fixture.chat.calls].sort((a, b) => toEpochSeconds(a.ts) - toEpochSeconds(b.ts));

  const messages: AnalysedMessage[] = sortedMessages.map((message, index) => {
    const tags = tagsFor({ sender: message.sender, text: message.text });
    return {
      id: evidenceSeqId('CHAT', index),
      ts: message.ts,
      sender: message.sender,
      text: message.text,
      tags,
      sentiment: sentimentFor(message.text, tags),
    };
  });

  const calls: AnalysedCall[] = sortedCalls.map((call, index) => ({
    id: evidenceSeqId('CALL', index),
    ts: call.ts,
    from: call.from,
    to: call.to,
    durationSec: call.durationSec,
    answered: call.answered,
  }));

  const riderAgreementIds: string[] = [];
  const riderRouteRequestIds: string[] = [];
  const riderObjectionIds: string[] = [];
  const threatIds: string[] = [];
  const instructionLikeIds: string[] = [];
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };

  for (const message of messages) {
    if (message.sender === 'rider') {
      if (message.tags.includes('agreement')) riderAgreementIds.push(message.id);
      if (message.tags.includes('route_request')) riderRouteRequestIds.push(message.id);
      if (message.tags.includes('objection')) riderObjectionIds.push(message.id);
    }
    if (message.tags.includes('threat')) threatIds.push(message.id);
    if (message.tags.includes('instruction_like')) instructionLikeIds.push(message.id);
    sentimentCounts[message.sentiment] += 1;
  }

  // §5.7: contact attempts exist only for no-show disputes with a cancellation time.
  // Driver messages with ts < cancelledAt, then calls from the driver with ts < cancelledAt.
  const cancelledAt = fixture.trip.cancelledAt;
  let driverContactAttemptsBeforeCancel: number | null = null;
  let contactCheckMet: boolean | null = null;
  const contactAttemptIds: string[] = [];
  if (fixture.dispute.category === 'no_show' && cancelledAt !== null) {
    const cancelSeconds = toEpochSeconds(cancelledAt);
    for (const message of messages) {
      if (message.sender === 'driver' && toEpochSeconds(message.ts) < cancelSeconds) {
        contactAttemptIds.push(message.id);
      }
    }
    for (const call of calls) {
      if (call.from === 'driver' && toEpochSeconds(call.ts) < cancelSeconds) {
        contactAttemptIds.push(call.id);
      }
    }
    driverContactAttemptsBeforeCancel = contactAttemptIds.length;
    contactCheckMet = driverContactAttemptsBeforeCancel >= params.minContactAttempts;
  }

  return {
    messages,
    calls,
    messageCount: messages.length,
    callCount: calls.length,
    riderAgreementIds,
    riderRouteRequestIds,
    riderObjectionIds,
    threatIds,
    instructionLikeIds,
    sentimentCounts,
    driverContactAttemptsBeforeCancel,
    contactAttemptIds,
    minContactAttempts: params.minContactAttempts,
    contactCheckMet,
  };
}
