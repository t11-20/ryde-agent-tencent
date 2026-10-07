# Contract requests to Lane A

Status legend: OPEN / AGREED / CHANGED. All are OPEN until Edward confirms.

| # | Request | Status |
|---|---|---|
| 1 | **Schema ownership.** Dispute, Evidence, PolicyClause and RemedyId come from `@fairtrip/evidence`. Lane A's contracts import them, not redefine them. | OPEN |
| 2 | **Run view.** `GET /api/runs/:id` returns: evidence records actually retrieved (deduped by ID), policy clauses accessed, both advocate cases, Judge result and final action, `missingEvidence`, `usage` when available. | OPEN |
| 3 | **Events.** Adopt the actor and type names of handoff section 7.2 (mirrored in `apps/web/src/contracts/provisional.ts`), or send the final list. Every event carries `refs`. | OPEN |
| 4 | **Tool errors.** `{ ok: false }` tool results go back to the advocate as tool output and are logged as a `tool_result` event. | OPEN |
| 5 | **Citation scope.** A citation must exist (`getEvidenceIndex`) **and** have been retrieved by some agent in this run (keeps M2 autonomy claim honest). | OPEN |
| 6 | **Remedy validation** via `getRemedyBasis`: reject remedies with `eligibleCents: null` (run → incomplete); reject `refund_route_excess` when `GPS-ROUTE.facts.exceedsThreshold` is false; amount always comes from the basis, never the model. | OPEN |
| 7 | **Port and prefix.** `http://localhost:3001`, routes under `/api`. | OPEN |
| 8 | **Ruling vocabulary.** `rider_upheld` / `driver_upheld` / `incomplete`, plus `favours` and the remedy. | OPEN |
| 9 | **Zod 4 and Node >= 22** on Lane A packages (version alignment). | OPEN |
| 10 | **Confidence scale.** `judge.confidence` is a number in `[0, 1]`. The UI shows other values as given, flagged as off-scale. | OPEN |
| 11 | **Policy clauses in the run view.** Return `policyClauses` (the clauses accessed). Without it, the UI marks every policy citation chip as unresolved. | OPEN |
| 12 | **Schemas and examples.** `docs/lane-b/contracts/` has JSON Schemas and example responses of what the UI and eval expect. Confirm them or send diffs. | OPEN |

See `LANE_A_GUIDE.md` for the integration summary.
