import type { ActivityEvent, Run } from '@fairtrip/contracts';

export function exportFileName(fixtureId: string, runId: string): string {
  return `fairtrip-${fixtureId}-${runId}.json`;
}

export function buildExport(run: Run, events: ActivityEvent[], apiMode: string, now: Date = new Date()): string {
  return JSON.stringify({
    exportedAt: now.toISOString(),
    apiMode,
    labels: ['DEMONSTRATION POLICY', 'SYNTHETIC DATA'],
    fixtureId: run.fixtureId,
    run: {...run, events}
  }, null, 2);
}

// Browser download via a temporary anchor; not unit-tested.
export function downloadJson(fileName: string, json: string): void {
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
