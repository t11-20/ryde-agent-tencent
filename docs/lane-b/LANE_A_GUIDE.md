# Integrating Lane A with Lane B

This guide is for whoever builds the agents, the Judge and the API (Lane A). It lists what Lane B's packages give you
and what the UI and evaluation runner expect back. Everything below is PROVISIONAL until both lanes agree it in
`CONTRACT_REQUESTS.md`.

## 1. What you import

```ts
import { createDisputeTools, TOOL_SPECS, listFixtures, getEvidenceIndex, getRemedyBasis } from "@fairtrip/evidence";
import { loadDataset } from "@fairtrip/evidence/node";
```

- `packages/evidence/README.md` documents the API, the evidence catalogue, the formulas and a tool-loop wiring example.
- `packages/evidence/examples/*.json` contains real tool outputs to develop prompts against, including a tool error and
  an `unavailable` family.
- The package uses Zod 4 and needs Node 22 or later. If your contracts compose our schemas, use Zod 4 as well.

## 2. Endpoints the UI and the evaluation runner call

| Endpoint | Request | Response schema |
|---|---|---|
| `GET /api/fixtures` | — | `contracts/fixtures.schema.json` (the output of `listFixtures(dataset)`) |
| `POST /api/runs` | `{ "fixtureId": "R1", "riderClaim"?: "..." }` | `contracts/create-run-response.schema.json` (`{ "runId" }`) |
| `GET /api/runs/:id?after=<seq>` | — | `contracts/run-view.schema.json`. `events` holds only events with `sequence > after`; every other field is the current full state |

Example responses for every outcome are in `contracts/examples/`:
- completed refund (R1)
- completed keep-charge (N2)
- incomplete (X1)
- provider timeout
- unknown citation

In these examples, the evidence, clauses and amounts are real computations, but the agent text is a scripted placeholder.

The default address is `http://localhost:3001`, with routes under `/api`. The web dev server proxies `/api` there.
Extra fields are fine, because both clients parse loosely. Missing required fields or wrong types show up as
**Contract mismatch** in the UI and as `contract_mismatch` in the evaluation runner.

## 3. Event vocabulary

| Actor | Event types it emits |
|---|---|
| `controller` | `run_started`, `handoff_to_judge`, `run_completed` / `run_incomplete` / `run_failed` |
| `rider_advocate`, `driver_advocate` | `tool_requested` (`data: { tool, args }`), `tool_result` (`refs.evidenceIds` / `refs.policyIds`), `case_submitted`, `case_rejected` |
| `judge` | `judge_started`, `ruling_issued` |
| `validator` | `validation_passed`, `validation_failed` |

The evaluation runner's `traceComplete` check needs all of the following:
- each advocate emits at least one `tool_requested` and one `tool_result`
- the retrieved evidence covers every available family
- both advocates emit `case_submitted`
- `handoff_to_judge` comes after both of them
- a terminal event exists

If you rename events, change `packages/eval/src/traceRules.ts` and tell Lane B, so the UI can follow.

## 4. Rules the evaluation runner enforces

- **Amounts.** `result.action.amountCents` must equal the `eligibleCents` from `getRemedyBasis`, as integer cents. If the
  remedy's basis is `null`, the run must end `incomplete` with **no** `result.action`.
- **Citations.** Every ID in the cases and in the Judge's findings must exist in `getEvidenceIndex` (evidence) or in the policy (clauses).
- **No reasoning in outputs.** `<think>` must not appear in cases, results, event summaries or errors, and no
  `reasoning_content` key may appear anywhere in the run view. With MiniMax, set `reasoning_split: true` or strip the tags.
- **Confidence** is a number in `[0, 1]`.
- **Policy chips.** Return `policyClauses` (the clauses accessed in the run). Without it, the UI shows policy citation chips as unresolved.

## 5. Self-test against your server

```bash
# UI against your API
cd apps/web && npm ci && npm run dev            # http://localhost:5173, proxies /api to :3001

# Evaluation runner
cd packages/eval && npm ci
npm run eval -- --fixtures R1 --delay-ms 0       # one quick run
npm run eval -- --fixtures golden                # the six golden fixtures
npm run eval -- --fixtures release --release-gate   # plan 12.3 gate (R1 and N2 run 3 times)
```

The raw run JSON and the scorecard go to `packages/eval/results/<timestamp>/`. Each failed check is listed with its reason.
