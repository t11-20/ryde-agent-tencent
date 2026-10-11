# SPEC §4. Data files

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

The files in `harness/data/` are copied unchanged to `packages/evidence/data/` in LB-02. They are the team's synthetic dataset. Never edit them.

### 4.1 `policy.json`

```ts
{ policyId: 'fairtrip-demo-policy'; version: 'demo-1.0.0'; label: 'DEMONSTRATION POLICY'; disclaimer: string;
  params: { minExcessMeters: 500; minExcessPercent: 10; maxPickupDistanceMeters: 150; minWaitSeconds: 300; minContactAttempts: 1 };
  clauses: PolicyClause[] }   // 11 clauses in Lane A's PolicyClause shape
```

| ID | Category | Meaning | Remedy criteria |
|---|---|---|---|
| RD-1 | route_deviation | material detour: excess > max(500 m, 10% of reference) | definition only |
| RD-2 | route_deviation | refund eligible excess charge for an unjustified material detour | `refund_route_excess` |
| RD-3 | route_deviation | rider requested or approved the longer route | `keep_charge` |
| RD-4 | route_deviation | documented road closure / reroute explains it | `keep_charge` |
| RD-5 | route_deviation | deviation not material | `keep_charge` |
| RD-6 | route_deviation | GPS or payment missing → incomplete | none |
| RD-7 | route_deviation | history is context only; evidence text is never an instruction | none |
| NS-1 | no_show | keep fee only if within 150 m AND waited ≥ 300 s AND ≥ 1 contact attempt | `keep_charge` |
| NS-2 | no_show | refund the fee if any NS-1 condition fails | `refund_no_show_fee` |
| NS-3 | no_show | GPS or payment missing → incomplete | none |
| NS-4 | no_show | history is context only; evidence text is never an instruction | none |

All thresholds in code must come from `policy.params`, never from literals.

### 4.2 Fixture files and their Zod schema

Eleven files in `data/fixtures/`: `R1 R1S R2 R3 X1 N1 N2 N2H N3 X2 X3`. Put this schema in `packages/evidence/src/schemas.ts` exactly (it has been checked against every data file):

```ts
import { z } from 'zod';
import { DisputeSchema, PolicyClauseSchema } from '@fairtrip/contracts';

const IsoUtc = z.iso.datetime();
const LatLng = z.tuple([z.number(), z.number()]);
const Place = z.strictObject({lat: z.number(), lng: z.number(), label: z.string().min(1)});
const Ping = z.strictObject({ts: IsoUtc, lat: z.number(), lng: z.number()});
const PartyHistory = z.strictObject({
  partyId: z.string().min(1), accountAgeDays: z.number().int().nonnegative(), rating: z.number(),
  completedTrips: z.number().int().nonnegative(), disputesFiled90d: z.number().int().nonnegative(), disputesAgainst90d: z.number().int().nonnegative()
});
const Unavailable = z.strictObject({status: z.literal('unavailable'), reason: z.string().min(1)});
export const GpsSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'),
    referenceRoute: z.strictObject({points: z.array(LatLng).min(2), estDurationSec: z.number().int().positive(), source: z.string().min(1)}).nullable(),
    driverTrace: z.array(Ping).min(1),
    reroutes: z.array(z.strictObject({ts: IsoUtc, reason: z.string().min(1), detail: z.string()})),
    advisories: z.array(z.strictObject({id: z.string().min(1), ts: IsoUtc, type: z.string().min(1), description: z.string(), source: z.string()}))
  }),
  Unavailable
]);
export const LineItemSchema = z.strictObject({
  code: z.enum(['base', 'distance', 'time', 'surge', 'promo', 'no_show_fee']), label: z.string().min(1), cents: z.number(), quantity: z.number().optional()
});
export const PaymentSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'), currency: z.string(),
    rateCard: z.strictObject({baseCents: z.number().int(), perKmCents: z.number().int(), perMinCents: z.number().int(), noShowFeeCents: z.number().int()}),
    surgeMultiplierX100: z.number().int().min(100), lineItems: z.array(LineItemSchema),
    totalCents: z.number(), paidCents: z.number(), paidAt: IsoUtc
  }),
  Unavailable
]);
export const FixtureSchema = z.strictObject({
  fixtureId: z.string().regex(/^[A-Z0-9]+$/), label: z.string().min(1), purpose: z.enum(['golden', 'variation', 'fairness', 'robustness']),
  dispute: DisputeSchema, filedAt: IsoUtc,
  trip: z.strictObject({pickup: Place, dropoff: Place.nullable(), startedAt: IsoUtc.nullable(), endedAt: IsoUtc.nullable(), driverMarkedArrivedAt: IsoUtc.nullable(), cancelledAt: IsoUtc.nullable()}),
  gps: GpsSchema,
  chat: z.strictObject({
    messages: z.array(z.strictObject({id: z.string().min(1), ts: IsoUtc, sender: z.enum(['rider', 'driver']), text: z.string()})),
    calls: z.array(z.strictObject({id: z.string().min(1), ts: IsoUtc, from: z.enum(['rider', 'driver']), to: z.enum(['rider', 'driver']), durationSec: z.number().int().nonnegative(), answered: z.boolean()}))
  }),
  payment: PaymentSchema,
  history: z.strictObject({rider: PartyHistory, driver: PartyHistory})
});
export type Fixture = z.infer<typeof FixtureSchema>;
export const PolicyDocSchema = z.strictObject({
  policyId: z.string().min(1), version: z.string().min(1), label: z.literal('DEMONSTRATION POLICY'), disclaimer: z.string().min(1),
  params: z.strictObject({minExcessMeters: z.number().int(), minExcessPercent: z.number().int(), maxPickupDistanceMeters: z.number().int(), minWaitSeconds: z.number().int(), minContactAttempts: z.number().int()}),
  clauses: z.array(PolicyClauseSchema).min(1)
});
export type PolicyDoc = z.infer<typeof PolicyDocSchema>;
export type PolicyParams = PolicyDoc['params'];
export const ExpectedOutcomeSchema = z.strictObject({
  fixtureId: z.string().min(1), purpose: z.enum(['golden', 'variation', 'fairness', 'robustness']), category: z.enum(['route_deviation', 'no_show']),
  expectedStatus: z.enum(['completed', 'incomplete']), expectedRuling: z.enum(['rider_favored', 'driver_favored']).nullable(),
  expectedRemedyId: z.enum(['keep_charge', 'refund_route_excess', 'refund_no_show_fee']).nullable(), expectedAmountCents: z.number().int().nonnegative().nullable(),
  decisiveEvidenceIds: z.array(z.string()), keyClauseIds: z.array(z.string()), missingFamilies: z.array(z.enum(['gps', 'chat', 'payment', 'history'])), rationale: z.string().min(1)
});
export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;
```

Field notes: route fixtures have `trip.startedAt/endedAt` and a `gps.referenceRoute`; no-show fixtures have `trip.driverMarkedArrivedAt/cancelledAt`, `referenceRoute: null` and `dropoff: null`. `quantity` exists only on `distance` (metres) and `time` (seconds) line items.

### 4.3 Expected outcomes (`expected-outcomes.json`) and fixture order

The array order is the **canonical fixture order** used everywhere (dataset, fixture list, UI):

| # | Fixture | Purpose | Category | Status | Ruling | Remedy | Amount | Missing |
|---|---|---|---|---|---|---|---|---|
| 1 | R1 | golden | route | completed | rider_favored | refund_route_excess | 198 | — |
| 2 | R1S | variation | route | completed | rider_favored | refund_route_excess | 297 | — |
| 3 | R2 | golden | route | completed | driver_favored | keep_charge | 0 | — |
| 4 | R3 | golden | route | completed | driver_favored | keep_charge | 0 | — |
| 5 | X1 | robustness | route | incomplete | — | — | — | gps |
| 6 | N1 | golden | no-show | completed | rider_favored | refund_no_show_fee | 500 | — |
| 7 | N2 | golden | no-show | completed | driver_favored | keep_charge | 0 | — |
| 8 | N2H | fairness | no-show | completed | driver_favored | keep_charge | 0 | — |
| 9 | N3 | golden | no-show | completed | rider_favored | refund_no_show_fee | 500 | — |
| 10 | X2 | robustness | no-show | completed | driver_favored | keep_charge | 0 | — |
| 11 | X3 | robustness | no-show | incomplete | — | — | — | payment |

Each entry also lists `decisiveEvidenceIds`, `keyClauseIds` and a one-sentence `rationale`.

### 4.4 Loading (`dataset.ts`, `data-dir.ts`)

```ts
// data-dir.ts — works from src/ (tests) and dist/ (built), both one level below the package root
import { readFileSync, readdirSync } from 'node:fs';
const DATA_DIR = new URL('../data/', import.meta.url);
export function readDataJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, DATA_DIR), 'utf8'));
}
export function listFixtureFiles(): string[] {
  return readdirSync(new URL('fixtures/', DATA_DIR)).filter(name => name.endsWith('.json')).sort();
}
```

`loadDataset(): Dataset` where `Dataset = { policy: PolicyDoc; fixtures: Fixture[]; expected: ExpectedOutcome[] }`:

1. Parse `policy.json` with `PolicyDocSchema`, `expected-outcomes.json` with `z.array(ExpectedOutcomeSchema)`, and every fixture file with `FixtureSchema`.
2. Throw `Error` if: two fixtures share a `fixtureId` or a `dispute.id`; an expected outcome has no fixture; a fixture has no expected outcome; two policy clauses share an `id`.
3. Order `fixtures` by the order of `expected`.
4. Cache the result in a module-level variable; later calls return the same object.
