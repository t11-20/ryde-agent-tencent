import { z } from "zod";
import { ExpectedOutcomeSchema, type ExpectedOutcome } from "./schemas/expected.js";
import { TripFixtureSchema, type TripFixture } from "./schemas/fixture.js";
import { PolicyDocSchema, type PolicyDoc } from "./schemas/policy.js";

export interface Dataset {
  policy: PolicyDoc;
  fixtures: TripFixture[];
  expectedOutcomes: ExpectedOutcome[];
}

export class UnknownDisputeError extends Error {
  constructor(public readonly disputeId: string) {
    super(`Unknown dispute: ${disputeId}`);
    this.name = "UnknownDisputeError";
  }
}

export class DatasetIntegrityError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Dataset integrity check failed:\n- ${problems.join("\n- ")}`);
    this.name = "DatasetIntegrityError";
  }
}

const dupes = (xs: readonly string[]): string[] => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

/** Pure (browser-safe) parse and integrity check. Throws ZodError or DatasetIntegrityError. */
export function parseDataset(raw: { policy: unknown; fixtures: unknown[]; expectedOutcomes?: unknown[] }): Dataset {
  const policy = PolicyDocSchema.parse(raw.policy);
  const fixtures = z.array(TripFixtureSchema).parse(raw.fixtures);
  const expectedOutcomes = z.array(ExpectedOutcomeSchema).parse(raw.expectedOutcomes ?? []);
  const problems: string[] = [];
  for (const d of dupes(policy.clauses.map((c) => c.id))) problems.push(`duplicate policy clause id ${d}`);
  for (const d of dupes(fixtures.map((f) => f.fixtureId))) problems.push(`duplicate fixtureId ${d}`);
  for (const d of dupes(fixtures.map((f) => f.dispute.id))) problems.push(`duplicate dispute id ${d}`);
  for (const d of dupes(expectedOutcomes.map((e) => e.fixtureId))) problems.push(`duplicate expected outcome for ${d}`);
  for (const f of fixtures) {
    const ids = [...f.comms.messages.map((m) => m.id), ...f.comms.calls.map((c) => c.id)];
    for (const d of dupes(ids)) problems.push(`fixture ${f.fixtureId}: duplicate message/call id ${d}`);
    for (const d of dupes(f.gps.status === "available" ? f.gps.trafficAdvisories.map((a) => a.id) : [])) problems.push(`fixture ${f.fixtureId}: duplicate advisory id ${d}`);
  }
  const fixtureIds = new Set(fixtures.map((f) => f.fixtureId));
  for (const e of expectedOutcomes) if (!fixtureIds.has(e.fixtureId)) problems.push(`expected outcome for unknown fixture ${e.fixtureId}`);
  if (problems.length) throw new DatasetIntegrityError(problems);
  return { policy, fixtures, expectedOutcomes };
}

export function findFixtureByDisputeId(dataset: Dataset, disputeId: string): TripFixture {
  const f = dataset.fixtures.find((x) => x.dispute.id === disputeId);
  if (!f) throw new UnknownDisputeError(disputeId);
  return f;
}

export function findFixture(dataset: Dataset, fixtureId: string): TripFixture | undefined {
  return dataset.fixtures.find((x) => x.fixtureId === fixtureId);
}

export function findExpected(dataset: Dataset, fixtureId: string): ExpectedOutcome | undefined {
  return dataset.expectedOutcomes.find((x) => x.fixtureId === fixtureId);
}
