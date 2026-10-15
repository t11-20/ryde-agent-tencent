import { ReviewRequestSchema, RunSchema, type Run } from '@fairtrip/contracts';
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
  // 'replay' is a first-class API mode; the fixtures list then holds only recorded fixtures.
  mode: z.string(),
  notice: z.string(),
  replay: z.looseObject({sourceEvalRun: z.string(), speed: z.number(), fixtures: z.number()}).optional(),
  fixtures: z.array(z.looseObject({
    id: z.string().min(1), category: z.enum(['route_deviation', 'no_show']), label: z.string(), kind: z.string(),
    purpose: z.string().optional(), riderClaim: z.string().optional(), driverStatement: z.string().optional()
  }))
});
export type FixturesResponse = z.infer<typeof FixturesResponseSchema>;
export type FixtureItem = FixturesResponse['fixtures'][number];
export const HealthResponseSchema = z.looseObject({
  status: z.string(), mode: z.string(), contractVersion: z.string(), modelAccess: z.string(),
  replay: z.looseObject({sourceEvalRun: z.string(), speed: z.number(), fixtures: z.number()}).optional()
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
const RunListItemSchema = z.looseObject({
  id: z.string().min(1), fixtureId: z.string().min(1), mode: z.string(), status: z.string(),
  createdAt: z.string(), remedyId: z.string().nullable(), amountCents: z.number().nullable(), escalated: z.boolean(),
  retryOf: z.string().nullable().optional()
});
const RunListResponseSchema = z.looseObject({runs: z.array(RunListItemSchema)});
export type RunListItem = z.infer<typeof RunListItemSchema>;
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
export async function fetchHealth(fetchImpl: Fetch = defaultFetch): Promise<HealthResponse> {
  const endpoint = 'GET /api/health';
  const parsed = HealthResponseSchema.safeParse(await getJson(endpoint, '/api/health', {}, fetchImpl));
  if (!parsed.success) throw new ContractMismatchError(endpoint, firstIssue(parsed.error));
  return parsed.data;
}
export async function listRuns(fetchImpl: Fetch = defaultFetch): Promise<RunListItem[]> {
  const endpoint = 'GET /api/runs';
  const parsed = RunListResponseSchema.safeParse(await getJson(endpoint, '/api/runs', {}, fetchImpl));
  if (!parsed.success) throw new ContractMismatchError(endpoint, firstIssue(parsed.error));
  return parsed.data.runs;
}
export async function fetchRun(id: string, after: number, fetchImpl: Fetch = defaultFetch): Promise<Run> {
  const endpoint = 'GET /api/runs/:id';
  const parsed = RunSchema.safeParse(await getJson(endpoint, `/api/runs/${encodeURIComponent(id)}?after=${after}`, {}, fetchImpl));
  if (!parsed.success) throw new ContractMismatchError(endpoint, firstIssue(parsed.error));
  return parsed.data;
}
// A failed run may carry retriedBy — the API's single automatic re-run after a
// first-attempt failure. The polling hook follows it.
export function nextRunId(run: Run): string | null {
  return run.status === 'failed' && typeof run.retriedBy === 'string' ? run.retriedBy : null;
}

const ErrorBodySchema = z.looseObject({error: z.looseObject({message: z.string()}).optional()});
type ReviewRequestInput = z.input<typeof ReviewRequestSchema>;
export async function postReview(id: string, body: ReviewRequestInput, fetchImpl: Fetch = defaultFetch): Promise<Run> {
  const endpoint = 'POST /api/runs/:id/review';
  let response: Response;
  try {
    response = await fetchImpl(`/api/runs/${encodeURIComponent(id)}/review`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : String(error));
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const parsed = ErrorBodySchema.safeParse(await response.json());
      if (parsed.success && parsed.data.error !== undefined) message = parsed.data.error.message;
    } catch { /* keep the status fallback */ }
    throw new NetworkError(message, response.status);
  }
  let data: unknown;
  try { data = await response.json(); } catch { throw new ContractMismatchError(endpoint, 'response is not JSON'); }
  const parsed = RunSchema.safeParse(data);
  if (!parsed.success) throw new ContractMismatchError(endpoint, firstIssue(parsed.error));
  return parsed.data;
}
