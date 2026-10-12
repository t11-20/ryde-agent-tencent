export function toEpochSeconds(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${iso}`);
  return ms / 1000;
}
export function secondsBetween(fromIso: string, toIso: string): number {
  return toEpochSeconds(toIso) - toEpochSeconds(fromIso);
}