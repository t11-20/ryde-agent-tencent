import type { CalculationProvider, DisputeSource, EvidenceTools, FixtureListing } from '@fairtrip/agents';
import type { Dispute, Evidence } from '@fairtrip/contracts';
import { z } from 'zod';
import { buildEvidence, type EvidenceBundle } from './build-evidence.js';
import { findFixture, findFixtureByDisputeId, loadDataset, type Dataset } from './dataset.js';
import { policyClausesFor } from './policy.js';

export const SOURCE_NOTICE = 'SYNTHETIC fixtures and DEMONSTRATION POLICY (not Ryde data or Ryde policy).';

// Families whose absence is decisive: without them no fault or amount can be established.
const DECISIVE_FAMILIES: Evidence['source'][] = ['gps', 'payment'];

// The server-computed remedy basis (SPEC §5.9) lives in PAY-REMEDY.facts.basis. Parse it; never trust it blindly.
const remedyFactsSchema = z.object({
  basis: z.array(z.object({ remedyId: z.string(), eligibleCents: z.number().int().nonnegative().nullable() })),
});
// The recomputed fare breakdown (SPEC §5.5) lives in PAY-FARE.facts; the refund cap is what the rider actually paid.
const fareFactsSchema = z.object({ paidCents: z.number() });

function findRecord(evidence: Evidence[], id: string): Evidence | undefined {
  return evidence.find(record => record.id === id);
}

/** Read one remedy's eligible amount from PAY-REMEDY; null when the record, entry or amount is absent. */
function eligibleAmount(evidence: Evidence[], remedyId: string): { amountCents: number; eligible: boolean } | null {
  const record = findRecord(evidence, 'PAY-REMEDY');
  if (record === undefined) return null;
  const parsed = remedyFactsSchema.safeParse(record.facts);
  if (!parsed.success) return null;
  const entry = parsed.data.basis.find(item => item.remedyId === remedyId);
  if (entry === undefined || entry.eligibleCents === null) return null;
  return { amountCents: entry.eligibleCents, eligible: true };
}

/** Expose the fixture dataset to Lane A as one DisputeSource (SPEC §8). */
export function createFixtureSource(dataset: Dataset = loadDataset()): DisputeSource {
  const bundleCache = new Map<string, EvidenceBundle>();

  function bundleFor(dispute: Dispute): EvidenceBundle {
    const hit = bundleCache.get(dispute.id);
    if (hit !== undefined) return hit;
    const fixture = findFixtureByDisputeId(dataset, dispute.id);
    if (fixture === undefined) throw new Error(`Unknown dispute ${dispute.id}`);
    const bundle = buildEvidence(fixture, dataset.policy);
    bundleCache.set(dispute.id, bundle);
    return bundle;
  }

  function allEvidence(dispute: Dispute): Evidence[] {
    return bundleFor(dispute).records;
  }

  function policiesFor(category: Dispute['category']) {
    return policyClausesFor(dataset.policy, category);
  }

  return {
    notice: SOURCE_NOTICE,

    listFixtures(): FixtureListing[] {
      return dataset.fixtures.map(fixture => ({
        id: fixture.fixtureId,
        category: fixture.dispute.category,
        label: fixture.label,
        kind: 'fixture',
        purpose: fixture.purpose,
        riderClaim: fixture.dispute.riderClaim,
        driverStatement: fixture.dispute.driverStatement,
      }));
    },

    getDispute(fixtureId: string): Dispute | undefined {
      const fixture = findFixture(dataset, fixtureId);
      return fixture === undefined ? undefined : structuredClone(fixture.dispute);
    },

    createTools(dispute: Dispute): EvidenceTools {
      return {
        async getEvidence(input) {
          const sources = input.sources;
          const matched = allEvidence(dispute).filter(record => sources.includes(record.source));
          return structuredClone(matched);
        },
        async getPolicy() {
          return structuredClone(policiesFor(dispute.category));
        },
      };
    },

    allEvidence,

    policiesFor,

    calculationProvider(): CalculationProvider {
      return {
        calculateRouteExcess(evidence) {
          return eligibleAmount(evidence, 'refund_route_excess');
        },
        getNoShowFee(evidence) {
          return eligibleAmount(evidence, 'refund_no_show_fee');
        },
        getPaidChargeCap(evidence) {
          const record = findRecord(evidence, 'PAY-FARE');
          if (record === undefined) return 0;
          const parsed = fareFactsSchema.safeParse(record.facts);
          return parsed.success ? parsed.data.paidCents : 0;
        },
      };
    },

    missingDecisiveEvidence(dispute: Dispute): string[] {
      const unavailable = bundleFor(dispute).unavailable;
      const missing: string[] = [];
      for (const family of DECISIVE_FAMILIES) {
        const entry = unavailable.find(item => item.family === family);
        if (entry !== undefined) missing.push(`${entry.family}: ${entry.reason}`);
      }
      return missing;
    },
  };
}
