# SPEC §2. Lane A interfaces you consume

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

### 2.1 Contracts (`@fairtrip/contracts`, Zod v4, all objects strict)

```ts
Dispute       = { id: string; category: 'route_deviation' | 'no_show'; tripId: string; riderClaim: string; driverStatement: string }
Evidence      = { id: string; source: 'gps' | 'chat' | 'payment' | 'history'; timestamp: string /* ISO, ends in Z */;
                  facts: Record<string, Json>; provenance: { kind: 'contract_example' | 'fixture'; description: string } }
PolicyClause  = { id: string; version: string; category: 'route_deviation' | 'no_show'; ruleText: string; remedyCriteria: string }
Argument      = { claim: string; evidenceIds: string[]; policyClauseIds: string[] }
AdvocateCase  = { side: 'rider' | 'driver'; summary: string; arguments: Argument[]; counterevidence: Argument[];
                  requestedRemedyId: RemedyId; missingFacts: string[] }
RemedyId      = 'keep_charge' | 'refund_route_excess' | 'refund_no_show_fee'
FinalAction   = { remedyId: RemedyId; recipient: 'rider' | 'driver' | 'none'; currency: 'SGD'; amountCents: number; recommendation: string }
JudgeResult   = { ruling: 'rider_favored' | 'driver_favored' | 'incomplete'; findings: Argument[]; remedyId: RemedyId;
                  confidence: number /* 0..1 */; reasoning: string; riderExplanation: string; driverExplanation: string; action: FinalAction }
ActivityEvent = { runId: string; sequence: number /* 1,2,3… */; timestamp: string; mode: 'stub' | 'live';
                  actor: 'system' | 'rider' | 'driver' | 'judge'; type: EventType; summary: string; evidenceIds: string[]; policyClauseIds: string[] }
Run           = common fields { id; fixtureId; mode; dispute: Dispute; cases: AdvocateCase[]; events: ActivityEvent[];
                                retrievedEvidence: Evidence[]; retrievedPolicies: PolicyClause[] }
                plus, by status:
                  'queued' | 'running' → nothing more
                  'completed'          → result: JudgeResult
                  'failed'             → error: { code: string; message: string }
                  'incomplete'         → missingEvidence: string[]   (at least one entry)
```

Import schemas and types from `@fairtrip/contracts`: `DisputeSchema`, `EvidenceSchema`, `PolicyClauseSchema`, `RunSchema`, `ActivityEventSchema`, and the types `Dispute`, `Evidence`, `PolicyClause`, `Run`, `ActivityEvent`, `AdvocateCase`, `JudgeResult`, `FinalAction`.

### 2.2 Events Lane A emits (what the UI and the evaluation runner see)

| Actor | Type | When | IDs carried |
|---|---|---|---|
| system | `run.started` | run accepted | — |
| rider / driver | `model.start` | advocate begins | — |
| rider / driver | `tool.requested` | each tool call; summary like `rider requested evidence: gps, chat, payment, history` or `rider requested policy for route_deviation` | — |
| rider / driver | `evidence.retrieved` | after `get_evidence` | `evidenceIds` |
| rider / driver | `policy.retrieved` | after `get_policy` | `policyClauseIds` |
| rider / driver / judge | `output.repair` | malformed model output, one repair | — |
| rider / driver | `model.finish` | advocate finished | — |
| rider / driver | `case.completed` | case validated | IDs cited in its arguments |
| judge | `judge.started` | both cases validated; **the handoff** | — |
| judge | `model.start`, `model.finish` | Judge model call | — |
| system | `run.completed` / `run.incomplete` / `run.failed` | terminal | — |

### 2.3 `@fairtrip/agents` interfaces

```ts
interface EvidenceTools {
  getEvidence(input: { sources: Evidence['source'][] }, signal: AbortSignal): Promise<Evidence[]>;
  getPolicy(input: { category: Dispute['category'] }, signal: AbortSignal): Promise<PolicyClause[]>;
}
interface CalculationProvider {
  calculateRouteExcess(evidence: Evidence[]): { amountCents: number; eligible: boolean } | null;
  getNoShowFee(evidence: Evidence[]): { amountCents: number; eligible: boolean } | null;
  getPaidChargeCap(evidence: Evidence[]): number;
}
```

`buildFinalAction` (Lane A) calls `calculateRouteExcess` for `refund_route_excess` and `getNoShowFee` for `refund_no_show_fee`, caps the amount with `getPaidChargeCap`, and turns `null` or `eligible: false` into an `incomplete` run. `keep_charge` is always 0 cents with recipient `none`. The `evidence` argument is **all** evidence records for the dispute (`DisputeSource.allEvidence`).

LB-08 adds `FixtureListing` and `DisputeSource` (§8) to `packages/agents/src/index.ts`.

### 2.4 HTTP API

| Endpoint | Response |
|---|---|
| `GET /api/health` | `{ status: 'ok', mode, contractVersion: '0.2.0', modelAccess }` |
| `GET /api/fixtures` | `{ mode, notice, fixtures }`. Stub: 2 items `{ id, category, label, kind: 'contract_example' }`. Live (after LB-09): 11 `FixtureListing` items (§8) |
| `POST /api/runs` body `{ fixtureId, riderClaim? }` | `202 { id, mode, status: 'queued' }`; `400` invalid body; `404` unknown fixture |
| `GET /api/runs/:id?after=N` | the full `Run`, with `events` filtered to `sequence > N`; `404` unknown run; `400` bad cursor |

Runs live in memory and vanish when the server restarts. Each live run has a 90-second deadline and a 20-second limit per model call.
