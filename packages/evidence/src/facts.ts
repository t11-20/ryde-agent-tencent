import type { Evidence } from '@fairtrip/contracts';

export type Facts = Evidence['facts'];

/** JSON round trip: drops undefined keys and guarantees plain JSON. */
export function asFacts(value: Record<string, unknown>): Facts {
  return JSON.parse(JSON.stringify(value)) as Facts;
}
