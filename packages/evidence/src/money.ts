/** Integer division rounding halves up. Both arguments must be non-negative safe integers; d > 0. */
export function divHalfUp(n: number, d: number): number {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n < 0 || d <= 0) throw new Error(`divHalfUp: invalid arguments ${n}, ${d}`);
  const r = n % d;
  const q = (n - r) / d;
  return 2 * r >= d ? q + 1 : q;
}
/** 198 → "S$1.98", 0 → "S$0.00", -300 → "-S$3.00". */
export function formatSgd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}S$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}