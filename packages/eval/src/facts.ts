import { buildEvidence, familiesAvailable, findExpected, findFixture, getEvidenceIndex, type Dataset, type EvidenceFamily } from "@fairtrip/evidence";
import type { FixtureFacts } from "./checks.js";

export function fixtureFacts(dataset: Dataset, fixtureId: string): FixtureFacts {
  const fixture = findFixture(dataset, fixtureId);
  const expected = findExpected(dataset, fixtureId);
  if (!fixture || !expected) throw new Error(`unknown fixture or no expected outcome: ${fixtureId}`);
  const bundle = buildEvidence(fixture, dataset.policy);
  const familyOf: Record<string, EvidenceFamily> = {};
  for (const r of bundle.records) familyOf[r.id] = r.family;
  const index = getEvidenceIndex(dataset, fixture.dispute.id);
  return {
    expected,
    evidenceIds: index.evidenceIds,
    clauseIds: index.clauseIds,
    familyOf,
    availableFamilies: familiesAvailable(bundle).filter((f) => bundle.records.some((r) => r.family === f)),
  };
}
