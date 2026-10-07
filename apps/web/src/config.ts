export type ApiMode = "live" | "mock";

/** VITE_API_MODE=live|mock (default live). Mock mode is for development only. */
export function apiMode(env: Record<string, unknown> = import.meta.env): ApiMode {
  return env.VITE_API_MODE === "mock" ? "mock" : "live";
}

/** VITE_API_BASE (default ""): same origin, forwarded by the Vite dev proxy. */
export function apiBase(env: Record<string, unknown> = import.meta.env): string {
  const v = env.VITE_API_BASE;
  return typeof v === "string" ? v.replace(/\/$/, "") : "";
}

export const RUN_DEADLINE_SEC = 90;
