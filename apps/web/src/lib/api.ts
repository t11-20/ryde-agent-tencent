import { RunSchema, type Run } from '@fairtrip/contracts';
import { z } from 'zod';

export class ContractMismatchError extends Error {
  constructor(public readonly endpoint: string, detail: string) {
    super(`Contract mismatch on ${endpoint}: ${detail}`);
    this.name = 'ContractMismatchError';
  }
}
export class NetworkError extends Error {
  constructor(message: string, public readonly status: number | null = null) {
    super(message);
    this.name = 'NetworkError';
  }
}
export const FixturesResponseSchema = z.looseObject({
  mode: z.string(),
  notice: z.string(),
  fixtures: z.array(z.looseObject({
    id: z.string().min(1), category: z.enum(['route_deviation', 'no_show']), label: z.string(), kind: z.string(),
    purpose: z.string().optional(), riderClaim: z.string().optional(), driverStatement: z.string().optional()
  }))
});
export type FixturesResponse = z.infer<typeof FixturesResponseSchema>;
export type FixtureItem = FixturesResponse['fixtures'][number];
const StartRunResponseSchema = z.looseObject({id: z.string().min(1), mode: z.string(), status: z.string()});
type Fetch = typeof fetch;
const defaultFetch: Fetch = (input, init) => fetch(input, init);

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}` : 'invalid response';
}
async function getJson(endpoint: string, url: string, init: RequestInit, fetchImpl: Fetch): Promise<unknown> {
  let response: Response;
  try { response = await fetchImpl(url, init); } catch (error) { throw new NetworkError(error instanceof Error ? error.message : String(error)); }
  if (!response.ok) throw new NetworkError(`${endpoint} returned HTTP ${response.status}`, response.status);
  try { return await response.json(); } catch { throw new ContractMismatchError(endpoint, 'response is not JSON'); }
}
export async function fetchFixtures(fetchImpl: Fetch = defaultFetch): Promise<FixturesResponse> {
  const endpoint = 'GET /api/fixtures';
  const parsed = FixturesResponseSchema.safeParse(await getJson(endpoint, '/api/fixtures', {}, fetchImpl));
  if (!parsed.success) throw new ContractMismatchError(endpoint, firstIssue(parsed.error));
  return parsed.data;
}
export async function startRun(input: {fixtureId: string; riderClaim?: string}, fetchImpl: Fetch = defaultFetch): Promise<{id: string}> {
  const endpoint = 'POST /api/runs';
  const body = await getJson(endpoint, '/api/runs', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)}, fetchImpl);
  const parsed = StartRunResponseSchema.safeParse(body);
  if (!parsed.success) throw new ContractMismatchError(endpoint, firstIssue(parsed.error));
  return {id: parsed.data.id};
}
export async function fetchRun(id: string, after: number, fetchImpl: Fetch = defaultFetch): Promise<Run> {
  const endpoint = 'GET /api/runs/:id';
  const parsed = RunSchema.safeParse(await getJson(endpoint, `/api/runs/${encodeURIComponent(id)}?after=${after}`, {}, fetchImpl));
  if (!parsed.success) throw new ContractMismatchError(endpoint, firstIssue(parsed.error));
  return parsed.data;
}
