import type { RunState } from "../state/useRun";

export function buildExport(state: RunState, mode: "live" | "mock", now = new Date()) {
  const v = state.view;
  return {
    fixtureId: state.fixtureId ?? null,
    runId: state.runId ?? null,
    mode,
    exportedAt: now.toISOString(),
    dispute: v?.dispute ?? null,
    status: state.status,
    events: state.events,
    evidence: v?.evidence ?? [],
    policyClauses: v?.policyClauses ?? [],
    cases: v?.cases ?? null,
    result: v?.result ?? null,
    error: state.error ?? v?.error ?? null,
    missingEvidence: v?.missingEvidence ?? [],
    usage: v?.usage ?? null,
    mismatch: state.mismatch ?? null,
  };
}

export const exportFileName = (state: RunState): string => `fairtrip-${state.fixtureId ?? "none"}-${state.runId ?? "none"}.json`;

export function downloadExport(state: RunState, mode: "live" | "mock"): void {
  const blob = new Blob([JSON.stringify(buildExport(state, mode), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(state);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
