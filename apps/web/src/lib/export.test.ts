import { describe, expect, it } from 'vitest';
import { buildExport, exportFileName } from './export.js';
import { completedRun, sampleEvents } from './test-runs.js';

describe('exportFileName', () => {
  it('builds the case-file name', () => {
    expect(exportFileName('R1', 'run-1')).toBe('fairtrip-R1-run-1.json');
  });
});

describe('buildExport', () => {
  it('includes labels, fixture id and the merged events', () => {
    const parsed = JSON.parse(buildExport(completedRun(), sampleEvents, 'live')) as
      {labels: string[]; fixtureId: string; run: {events: unknown[]}};
    expect(parsed.labels).toEqual(['DEMONSTRATION POLICY', 'SYNTHETIC DATA']);
    expect(parsed.fixtureId).toBe('R1');
    expect(parsed.run.events).toHaveLength(9);
  });
});
