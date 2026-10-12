# SPEC §8. Dispute source (the integration seam)

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

Added to `packages/agents/src/index.ts` in LB-08 (code given in the card):

```ts
export interface FixtureListing { id: string; category: Dispute['category']; label: string; kind: 'fixture'; purpose: string; riderClaim: string; driverStatement: string }
export interface DisputeSource {
  readonly notice: string;
  listFixtures(): FixtureListing[];
  getDispute(fixtureId: string): Dispute | undefined;
  createTools(dispute: Dispute): EvidenceTools;
  allEvidence(dispute: Dispute): Evidence[];
  policiesFor(category: Dispute['category']): PolicyClause[];
  calculationProvider(dispute: Dispute): CalculationProvider;
  missingDecisiveEvidence(dispute: Dispute): string[];
}
```

`createFixtureSource(dataset = loadDataset()): DisputeSource` in `packages/evidence/src/source.ts`:

| Member | Behaviour |
|---|---|
| `notice` | `'SYNTHETIC fixtures and DEMONSTRATION POLICY (not Ryde data or Ryde policy).'` |
| `listFixtures()` | one item per fixture in canonical order: `{ id: fixtureId, category, label, kind: 'fixture', purpose, riderClaim, driverStatement }` |
| `getDispute(fixtureId)` | a copy of the fixture's `dispute`, or `undefined` |
| `allEvidence(dispute)` | `buildEvidence(fixture, policy).records` for the fixture whose `dispute.id` matches; cache per dispute ID; throw `Error('Unknown dispute …')` if none |
| `createTools(dispute)` | `getEvidence({sources})` → the records of `allEvidence(dispute)` whose `source` is in `sources`, in catalogue order. `getPolicy()` → `policiesFor(dispute.category)` (the tool is bound to the dispute's own category, whatever category was requested) |
| `policiesFor(category)` | `policy.clauses` filtered by category, in file order (RD-1…RD-7 or NS-1…NS-4) |
| `calculationProvider(dispute)` | reads from the `evidence` array it is given: `calculateRouteExcess` → the `refund_route_excess` entry of `PAY-REMEDY.facts.basis`; `getNoShowFee` → the `refund_no_show_fee` entry; each returns `null` if the record or entry is missing or `eligibleCents` is `null`, else `{ amountCents: eligibleCents, eligible: true }`. `getPaidChargeCap` → `PAY-FARE.facts.paidCents` if it is a number, else `0`. Parse facts with Zod; never trust them blindly |
| `missingDecisiveEvidence(dispute)` | for each `unavailable` family in `['gps', 'payment']`: `` `${family}: ${reason}` ``; empty array when nothing decisive is missing |
