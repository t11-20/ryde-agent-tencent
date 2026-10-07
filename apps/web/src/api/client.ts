import type { z } from "zod";
import {
  CreateRunResponseSchema,
  FixtureListSchema,
  RunViewSchema,
  type FixtureListItem,
  type RunView,
} from "../contracts/provisional";

export interface CreateRunRequest {
  fixtureId: string;
  riderClaim?: string;
}

export interface ApiClient {
  readonly mode: "live" | "mock";
  listFixtures(signal?: AbortSignal): Promise<FixtureListItem[]>;
  createRun(req: CreateRunRequest, signal?: AbortSignal): Promise<{ runId: string }>;
  getRun(runId: string, after: number, signal?: AbortSignal): Promise<RunView>;
}

/** The response did not match the contract. Never retried; rendered as "Contract mismatch". */
export class ContractMismatchError extends Error {
  constructor(public readonly endpoint: string, public readonly issues: unknown) {
    super(`Contract mismatch on ${endpoint}`);
    this.name = "ContractMismatchError";
  }
}

/** Transport failure or non-2xx response. Polling counts these toward the stall limit. */
export class NetworkError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "NetworkError";
  }
}

export function parseOrMismatch<S extends z.ZodType>(schema: S, endpoint: string, body: unknown): z.infer<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw new ContractMismatchError(endpoint, r.error.issues);
  return r.data;
}

export class LiveApiClient implements ApiClient {
  readonly mode = "live" as const;
  constructor(private readonly base: string = "", private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, init);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new NetworkError(e instanceof Error ? e.message : String(e));
    }
    if (!res.ok) throw new NetworkError(`HTTP ${res.status} from ${path}`, res.status);
    try {
      return await res.json();
    } catch {
      throw new ContractMismatchError(path, "response body is not JSON");
    }
  }

  async listFixtures(signal?: AbortSignal): Promise<FixtureListItem[]> {
    return parseOrMismatch(FixtureListSchema, "GET /api/fixtures", await this.request("/api/fixtures", { signal }));
  }

  async createRun(req: CreateRunRequest, signal?: AbortSignal): Promise<{ runId: string }> {
    const body = await this.request("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
    return parseOrMismatch(CreateRunResponseSchema, "POST /api/runs", body);
  }

  async getRun(runId: string, after: number, signal?: AbortSignal): Promise<RunView> {
    const body = await this.request(`/api/runs/${encodeURIComponent(runId)}?after=${after}`, { signal });
    return parseOrMismatch(RunViewSchema, "GET /api/runs/:id", body);
  }
}
