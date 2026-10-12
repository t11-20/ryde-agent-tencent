import { z } from 'zod';
import { listFixtureFiles, readDataJson } from './data-dir.js';
import {
  ExpectedOutcomeSchema,
  FixtureSchema,
  PolicyDocSchema,
  type ExpectedOutcome,
  type Fixture,
  type PolicyDoc
} from './schemas.js';

export interface Dataset { policy: PolicyDoc; fixtures: Fixture[]; expected: ExpectedOutcome[] }
let cached: Dataset | undefined;

export function loadDataset(): Dataset {
  if (cached !== undefined) return cached;

  const policy = PolicyDocSchema.parse(readDataJson('policy.json'));
  const expected = z.array(ExpectedOutcomeSchema).parse(readDataJson('expected-outcomes.json'));

  const clauseIds = new Set<string>();
  for (const clause of policy.clauses) {
    if (clauseIds.has(clause.id)) throw new Error(`Dataset integrity: duplicate policy clause id ${clause.id}`);
    clauseIds.add(clause.id);
  }

  const fixturesById = new Map<string, Fixture>();
  const disputeIds = new Set<string>();
  for (const name of listFixtureFiles()) {
    const fixture = FixtureSchema.parse(readDataJson('fixtures/' + name));
    if (fixturesById.has(fixture.fixtureId)) throw new Error(`Dataset integrity: duplicate fixtureId ${fixture.fixtureId}`);
    if (disputeIds.has(fixture.dispute.id)) throw new Error(`Dataset integrity: duplicate dispute id ${fixture.dispute.id}`);
    fixturesById.set(fixture.fixtureId, fixture);
    disputeIds.add(fixture.dispute.id);
  }

  // The expected-outcomes array order is the canonical fixture order (SPEC §4.3).
  const fixtures: Fixture[] = [];
  const orderedIds = new Set<string>();
  for (const outcome of expected) {
    if (orderedIds.has(outcome.fixtureId)) throw new Error(`Dataset integrity: duplicate expected outcome for ${outcome.fixtureId}`);
    orderedIds.add(outcome.fixtureId);
    const fixture = fixturesById.get(outcome.fixtureId);
    if (fixture === undefined) throw new Error(`Dataset integrity: expected outcome has no fixture ${outcome.fixtureId}`);
    fixtures.push(fixture);
  }
  for (const fixtureId of fixturesById.keys()) {
    if (!orderedIds.has(fixtureId)) throw new Error(`Dataset integrity: fixture ${fixtureId} has no expected outcome`);
  }

  cached = { policy, fixtures, expected };
  return cached;
}

export function findFixture(dataset: Dataset, fixtureId: string): Fixture | undefined {
  return dataset.fixtures.find(fixture => fixture.fixtureId === fixtureId);
}

export function findFixtureByDisputeId(dataset: Dataset, disputeId: string): Fixture | undefined {
  return dataset.fixtures.find(fixture => fixture.dispute.id === disputeId);
}

export function findExpected(dataset: Dataset, fixtureId: string): ExpectedOutcome | undefined {
  return dataset.expected.find(outcome => outcome.fixtureId === fixtureId);
}
