import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunSchema } from '@fairtrip/contracts';
import type { Run } from '@fairtrip/contracts';
import { describe, expect, it } from 'vitest';
import { formatSgd } from '../lib/format.js';
import { completedRun } from '../lib/test-runs.js';
import { HearingBoard, VerdictSegment } from './HearingPresentation.js';

type CompletedRun = Extract<Run, {status: 'completed'}>;

function completed(): CompletedRun {
  const run = completedRun();
  if (run.status !== 'completed') throw new Error('Expected a completed test run');
  return run;
}

function pendingReview(): CompletedRun {
  const run = completed();
  const parsed = RunSchema.parse({...run, escalation: {
    reasons: ['low_confidence'], confidence: run.result.confidence,
    threshold: 1, summary: 'The Judge recommendation requires human review.',
  }});
  if (parsed.status !== 'completed') throw new Error('Expected a completed test run');
  return parsed;
}

function renderVerdict(run: Run): string {
  return renderToStaticMarkup(createElement(VerdictSegment, {run, phase: 'done', problem: null}));
}

describe('glass verdict review states', () => {
  it('keeps an ordinary completed decision final and uses its server amount', () => {
    const run = completed();
    const html = renderVerdict(run);
    expect(html).toContain('Final decision');
    expect(html).toContain(formatSgd(run.result.action.amountCents));
    expect(html).not.toContain('Proposed amount');
  });

  it('labels escalated recommendations and their amount as pending human review', () => {
    const run = pendingReview();
    const html = renderVerdict(run);
    expect(html).toContain('Human review');
    expect(html).toContain('Judge recommendation');
    expect(html).toContain('Proposed amount');
    expect(html).toContain(formatSgd(run.result.action.amountCents));
    expect(html).toContain('No payment amount issued');
    expect(html).toContain('data-seal="review"');
    expect(html).not.toContain('Final decision');
  });

  it('uses the human override ruling and action instead of the original Judge remedy', () => {
    const pending = pendingReview();
    const run = RunSchema.parse({...pending, review: {
      decision: 'overridden', decidedAt: pending.events.at(-1)?.timestamp,
      note: 'A human reviewer retained the charge.', ruling: 'driver_favored',
      action: {remedyId: 'keep_charge', recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Keep the charge.'},
    }});
    const html = renderVerdict(run);
    expect(html).toContain('Final decision');
    expect(html).toContain('Driver&#x27;s position upheld');
    expect(html).toContain('Keep the charge (no refund)');
    expect(html).toContain(formatSgd(0));
    expect(html).toContain('Overridden by a human reviewer');
    expect(html).toContain('A human reviewer retained the charge.');
    expect(html).not.toContain(formatSgd(pending.result.action.amountCents));
    expect(html).not.toContain('Refund the excess-distance charge');
    expect(html).not.toContain('Proposed amount');
  });

  it('marks a confirmed recommendation as a human decision using its existing action', () => {
    const pending = pendingReview();
    const run = RunSchema.parse({...pending, review: {
      decision: 'confirmed', decidedAt: pending.events.at(-1)?.timestamp,
      note: '', ruling: pending.result.ruling, action: pending.result.action,
    }});
    const html = renderVerdict(run);
    expect(html).toContain('Final decision');
    expect(html).toContain('Confirmed by a human reviewer');
    expect(html).toContain(formatSgd(pending.result.action.amountCents));
    expect(html).not.toContain('Proposed amount');
  });

  it('keeps the full hearing board pending until the required human review', () => {
    const run = pendingReview();
    const html = renderToStaticMarkup(createElement(HearingBoard, {
      run, events: run.events, caseContent: null, phase: 'done', problem: null,
    }));
    expect(html).toContain('Human review needed');
    expect(html).toContain('Judge recommendation · Awaiting human review');
    expect(html).not.toContain('Final decision');
    expect(html).not.toContain('Decision ready');
    expect(html).not.toContain('aria-valuenow="100"');
  });

  it('preserves original AI findings as historical findings after a human decision', () => {
    const pending = pendingReview();
    const run = RunSchema.parse({...pending, review: {
      decision: 'overridden', decidedAt: pending.events.at(-1)?.timestamp,
      note: '', ruling: 'driver_favored',
      action: {remedyId: 'keep_charge', recipient: 'none', currency: 'SGD', amountCents: 0, recommendation: 'Keep the charge.'},
    }});
    const html = renderToStaticMarkup(createElement(HearingBoard, {
      run, events: run.events, caseContent: null, phase: 'done', problem: null,
    }));
    expect(html).toContain('Original Judge findings · See the verdict for the human decision');
    expect(html).toContain(pending.result.findings[0]?.claim);
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('Overridden by a human reviewer');
  });
});
