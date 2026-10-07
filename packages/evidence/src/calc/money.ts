/**
 * Half-up integer division for non-negative safe integers.
 * r = n % d; q = (n - r) / d; return 2r >= d ? q + 1 : q
 */
export function divHalfUp(n: number, d: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`divHalfUp: numerator must be a non-negative safe integer, got ${n}`);
  if (!Number.isSafeInteger(d) || d <= 0) throw new RangeError(`divHalfUp: divisor must be a positive safe integer, got ${d}`);
  const r = n % d;
  const q = (n - r) / d;
  return 2 * r >= d ? q + 1 : q;
}

/** "S$1.98" for 198; "-S$3.00" for -300. Integer cents only. */
export function formatSgd(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`formatSgd: cents must be a safe integer, got ${cents}`);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = (abs - (abs % 100)) / 100;
  return `${sign}S$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

export const isSafeInt = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x);
export const isNonNegInt = (x: unknown): x is number => isSafeInt(x) && x >= 0;
