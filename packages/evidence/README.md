# @fairtrip/evidence

The evidence layer for FairTrip (Lane B). It provides:

- Zod schemas for disputes, fixtures, evidence and policy, with inferred TypeScript types.
- Deterministic calculations for route, pickup, fare and remedy.
- Evidence adapters that build a stable evidence catalogue.
- The two tools Lane A's advocates call: `get_evidence` and `get_policy`.

> **All data is SYNTHETIC.** The rules in `data/policy/demo-policy.v1.json` are a **DEMONSTRATION POLICY**: synthetic
> rules chosen by the FairTrip team for this prototype. They are **not Ryde policy**. The comparison path is a
> **reference route**, not an optimal or road-network route.

## Install and scripts

Standalone package (no root workspace yet). Node >= 22, TypeScript 5.9, Zod 4.

```bash
npm ci
npm run build           # dist/ with .d.ts
npm run typecheck
npm test
npm run fixtures:build  # regenerate data/fixtures/*.json and data/expected-outcomes.json
npm run fixtures:check  # regenerate into a temp dir and diff against the committed files
npm run examples:build  # regenerate examples/*.json
npm run audit           # regenerate docs/lane-b/EVIDENCE_AUDIT.md
```

Never hand-edit generated JSON. To change a fixture, edit `scripts/lib/fixtures.ts` and rebuild.

## Entry points

| Import | Contents |
|---|---|
| `@fairtrip/evidence` | **Browser-safe** (no `fs`/`path`). Schemas, types, calculations, `buildEvidence`, tools, `parseDataset`, format helpers |
| `@fairtrip/evidence/node` | Everything above, plus `loadDataset(dataDir?)` (defaults to this package's `data/`) |
| `@fairtrip/evidence/data/*` | Raw JSON (policy, fixtures, expected outcomes) |

## API

```ts
loadDataset(dataDir?): Dataset                       // node entry; Zod-parses everything; rejects duplicate IDs
createDisputeTools(dataset, disputeId): {            // throws UnknownDisputeError for an unknown dispute
  disputeId;
  get_evidence(args: unknown): ToolResult<GetEvidenceResult>;  // args: { sources: EvidenceFamily[] } strict, 1–4, deduped
  get_policy(args: unknown): ToolResult<GetPolicyResult>;      // args: { category } strict; category + GEN clauses
}
TOOL_SPECS                                           // [{ name, description, parameters: JSON Schema }]
listFixtures(dataset)                                // backs GET /api/fixtures
getEvidenceIndex(dataset, disputeId)                 // { evidenceIds, clauseIds } for citation validation
getRemedyBasis(dataset, disputeId)                   // RemedyBasis[] for remedy validation (integer cents or null)
buildEvidence(fixture, policy)                       // { fixtureId, disputeId, records, unavailable }
```

`ToolResult<T>` is `{ ok: true, data }` or `{ ok: false, error: { code: "invalid_arguments" | "internal", message, issues? } }`.
The tools never throw on bad arguments. An agent cannot name a trip, rider or driver: every call is bound to one dispute.

## Wiring the tools into Lane A's tool loop

```ts
import { createDisputeTools, TOOL_SPECS, getEvidenceIndex, getRemedyBasis } from "@fairtrip/evidence";
import { loadDataset } from "@fairtrip/evidence/node";

const dataset = loadDataset();                                 // once, at server start
const tools = createDisputeTools(dataset, run.disputeId);      // per run (throws UnknownDisputeError)
const specs = TOOL_SPECS.map((t) => ({ type: "function", function: t }));   // OpenAI-compatible tools

for (const call of assistantMessage.tool_calls ?? []) {
  const args = safeJsonParse(call.function.arguments);         // model output is untrusted
  const result = call.function.name === "get_evidence" ? tools.get_evidence(args)
               : call.function.name === "get_policy"   ? tools.get_policy(args)
               : { ok: false, error: { code: "invalid_arguments", message: "unknown tool" } };
  messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
  emit({ type: "tool_result", actor, refs: { evidenceIds: result.ok && "records" in result.data ? result.data.records.map((r) => r.id) : [] } });
}
// Validation: citations ⊆ getEvidenceIndex(...); amount = getRemedyBasis(...).find(remedyId).eligibleCents (null ⇒ incomplete).
```

## Evidence catalogue

Every record has the shape `{ id, family, kind, timestamp, summary, facts, provenance }`.
`provenance.source` is `"synthetic_fixture"`. IDs are deterministic: the same fixture always produces the same IDs and facts.

| ID | Family | Kind | When emitted | Key facts |
|---|---|---|---|---|
| `GPS-ROUTE` | gps | `route_metrics` | Route category, GPS available | reference/actual/excess metres, `excessPct`, `thresholdMeters`, `exceedsThreshold`, durations, `unexpectedStops`, `referenceRouteSource` |
| `GPS-NAV-01`… | gps | `nav_event` | One per `reroute` event | type, reason, detail |
| `GPS-ADV-01`… | gps | `traffic_advisory` | One per advisory | id, type, description, source |
| `GPS-PICKUP` | gps | `pickup_metrics` | No-show, GPS available | closest approach, first-within-threshold, wait, `remainedWithinThreshold`, `checks` |
| `GPS-RIDER` | gps | `rider_location` | No-show, GPS available | rider distances, or `{ available: false }` |
| `CHAT-01`… | chat | `chat_message` | One per message, in time order | sender, verbatim text, `tags`, `tagMethod`, `untrusted: true`, `relativeToCancel` (no-show) |
| `CALL-01`… | chat | `call_log` | One per call | from, to, durationSec, answered |
| `CHAT-CONTACT` | chat | `contact_summary` | No-show | attempts before cancel, after arrival, `attemptIds`, `contactMinimumMet` |
| `PAY-FARE` | payment | `fare_breakdown` | Payment available | rate card, surge, line items, totals, `arithmeticValid`, anomalies, observations |
| `PAY-REMEDY` | payment | `remedy_basis` | Payment available | the remedy basis list |
| `HIST-RIDER`, `HIST-DRIVER` | history | `party_history` | Always | profile fields + `caveat: "Context only. Cannot establish fault (GEN-2)."` |

A missing family comes back in `unavailable: [{ family, reason }]`. It never comes back as an empty success.

## Formulas and rounding

- **Distance:** haversine with R = 6,371,008.8 m. Path length is the sum of segments. **Every distance is rounded to whole metres** before any comparison or output.
- **Durations** are whole seconds. **Percentages** are rounded to one decimal place.
- **Money:** integer SGD cents only. `divHalfUp(n, d)` requires both arguments to be non-negative safe integers, with `d > 0`.
  - It computes `r = n % d; q = (n - r) / d` and returns `2r >= d ? q + 1 : q`.
  - `formatSgd(198)` gives `"S$1.98"`.
- **RD-1** (from policy params):
  - `thresholdMeters = max(minExcessMeters, round(minExcessRatio × referenceMeters))`
  - material iff `excessMeters > thresholdMeters` (strict)
- **NS-1** (from policy params):
  - `withinDistance`: some driver ping at or before the cancellation is ≤ 150 m from the pin (inclusive).
  - `waitedMinimum`: `cancelTs − firstWithinThresholdTs ≥ 300 s` (inclusive).
  - Contact: at least 1 driver→rider message or call with `ts < cancelTs`.
- **Fare check:** re-computes each item with `divHalfUp` against the rate card:
  - `distance = divHalfUp(m × perKm, 1000)`
  - `time = divHalfUp(s × perMin, 60)`
  - `surge = divHalfUp((base + distance + time) × (X100 − 100), 100)`

  It also checks signs, the sum, `paid == total` and currency SGD. Any anomaly sets `arithmeticValid: false`.
- **Remedy basis:**
  - `keep_charge` is always 0.
  - `refund_route_excess = min(divHalfUp(excess × perKm × X100, 100000), divHalfUp(distanceCents × X100, 100), paid)`
  - `refund_no_show_fee = min(Σ no_show_fee, paid)`

  A remedy is `null` (with `unavailableReason`) when its inputs are missing, the fare is invalid, or it does not apply to the category.
- **Chat tags** are keyword heuristics (`tagMethod: "keyword_heuristic"`). They are hints only and never change program logic. `instruction_like` flags text that looks like an instruction to the resolution process (GEN-3).

Thresholds are read from the policy file's `params`. Dwell detection (30 m, 120 s, 150 m endpoint exclusion) is a heuristic constant in `src/calc/route.ts`.

## Fixtures

There are 12 synthetic fixtures: golden R1, R2, R3, N1, N2, N3; variation R1S; edge NE; fairness N2H; robustness X1 (no GPS), X2 (prompt injection) and X3 (no payment).

- Expected outcomes are in `data/expected-outcomes.json`. The amounts come from `getRemedyBasis`.
- Computed facts per fixture are in `docs/lane-b/EVIDENCE_AUDIT.md`.
- One known discrepancy with the handoff's reference values (N3 wait 225 s vs 210 s) is documented in `docs/lane-b/INTEGRATION.md`.

## Examples for Lane A

`examples/` contains generated tool outputs to develop against:
- `get_evidence.R1.all.json`, `get_evidence.N2.all.json`, `get_evidence.X1.gps.json` (shows `unavailable`)
- `get_policy.route_deviation.json`, `get_policy.no_show.json`
- `tool_error.invalid_source.json`
- `remedy_basis.R1.json`
- `fixtures_list.json`
