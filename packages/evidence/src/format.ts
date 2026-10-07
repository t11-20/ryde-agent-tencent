export { formatSgd } from "./calc/money.js";

/** 10598 -> "10.60 km" (display only). */
export function formatKm(meters: number): string {
  const sign = meters < 0 ? "-" : "";
  const abs = Math.round(Math.abs(meters) / 10);
  return `${sign}${(abs - (abs % 100)) / 100}.${String(abs % 100).padStart(2, "0")} km`;
}

/** 430 -> "7m 10s". */
export function formatDuration(sec: number): string {
  const s = Math.abs(Math.round(sec));
  const m = Math.floor(s / 60);
  return `${sec < 0 ? "-" : ""}${m > 0 ? `${m}m ` : ""}${s % 60}s`;
}

/** "CHAT", 3 -> "CHAT-03". */
export const seqId = (prefix: string, n: number): string => `${prefix}-${String(n).padStart(2, "0")}`;
