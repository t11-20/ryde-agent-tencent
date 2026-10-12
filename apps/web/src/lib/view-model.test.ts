import { RunSchema } from '@fairtrip/contracts';
import { describe, expect, it } from 'vitest';
import { buildViewModel } from './view-model.js';
import { completedRun, failedRun, incompleteRun, sampleEvents } from './test-runs.js';

describe('test builders', () => {
  it('all three builders produce schema-valid runs', () => {
    expect(RunSchema.safeParse(completedRun()).success).toBe(true);
    expect(RunSchema.safeParse(incompleteRun()).success).toBe(true);
    expect(RunSchema.safeParse(failedRun()).success).toBe(true);
  });
});

describe('showAction', () => {
  it('is true only for completed runs', () => {
    expect(buildViewModel(completedRun(), sampleEvents).showAction).toBe(true);
    expect(buildViewModel(incompleteRun(), sampleEvents).showAction).toBe(false);
    expect(buildViewModel(failedRun(), sampleEvents).showAction).toBe(false);
  });
});

describe('terminal states', () => {
  it('failed runs surface the error code', () => {
    expect(buildViewModel(failedRun(), sampleEvents).error?.code).toBe('WORKFLOW_FAILED');
  });
  it('incomplete runs list the missing evidence', () => {
    expect(buildViewModel(incompleteRun(), sampleEvents).missingEvidence).toEqual(['gps: synthetic telemetry gap']);
  });
});

describe('evidence cards', () => {
  const model = buildViewModel(completedRun(), sampleEvents);
  const [gps] = model.evidence.gps;
  const [chat] = model.evidence.chat;

  it('records which advocates retrieved each record', () => {
    expect(gps?.retrievedBy).toEqual(['rider', 'driver']);
  });
  it('flags instruction-like chat text but keeps it as plain text', () => {
    expect(chat?.instructionLike).toBe(true);
    expect(chat?.text).toContain('<b>');
  });
});

describe('knownIds and handoff', () => {
  const model = buildViewModel(completedRun(), sampleEvents);
  it('does not know IDs that were never retrieved', () => {
    expect(model.knownIds.has('CHAT-99')).toBe(false);
  });
  it('finds the judge handoff sequence', () => {
    expect(model.handoffSequence).toBe(8);
  });
});
