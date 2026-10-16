import type { Run } from '@fairtrip/contracts';
import { policyVerdictRemedy } from '../lib/present.js';
import type { RemedyOption } from '../lib/present.js';

export interface ReviewActions {
  confirm: boolean;
  override: boolean;
  /** A deterministic policy remedy that differs from the Judge's, when one exists. */
  applyVerdictId: RemedyOption['id'] | null;
}

/** Which reviewer actions a run is eligible for — only a completed, escalated, undecided run. */
export function reviewActions(run: Run | null): ReviewActions {
  if (run === null || run.status !== 'completed' || run.escalation === undefined || run.review !== undefined)
    return {confirm: false, override: false, applyVerdictId: null};
  return {confirm: true, override: true, applyVerdictId: policyVerdictRemedy(run)};
}
