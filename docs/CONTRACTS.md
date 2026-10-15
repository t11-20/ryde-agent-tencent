# Shared interfaces — version 0.3.3

Import schemas and inferred types from `@fairtrip/contracts`. One backend/browser contract source prevents divergence. Both lanes must review changes and update examples together before freezing the interface.

| Contract | Required data |
|---|---|
| Dispute | ID, category (`route_deviation` or `no_show`), trip ID, rider claim, driver statement |
| Evidence | ID, source family, ISO timestamp, JSON facts, provenance |
| PolicyClause | ID, version, category, rule text, remedy criteria |
| AdvocateCase | Side, summary, arguments with evidence/policy IDs, counterevidence, requested remedy, missing facts |
| JudgeModelResponse | Ruling, cited findings, remedyId, confidence 0–1, reasoning, both explanations (NO action/money) |
| JudgeResult | JudgeModelResponse + server-constructed FinalAction with validated amount/recipient |
| FinalAction | Remedy, recipient, SGD currency, safe integer cents, recommendation; keep_charge requires zero and no recipient |
| ActivityEvent | Run ID, increasing sequence, ISO timestamp, mode, actor, type, summary, citation IDs |
| Run | ID, fixture ID, mode (`stub`, `live` or `replay`), dispute, cases, events, retrievedEvidence, retrievedPolicies, discriminated status and result/error/missing-evidence payload; optional risk assessment, matched precedents, replay provenance, policy verdict, divergence record, and retry linkage (`retryOf`/`retriedBy`) |
| PolicyVerdict | Optional run field: deterministic demonstration-policy outcome (`keep_charge`, a remedy, `incomplete` or `undetermined`), deciding clause IDs, one-sentence basis, deciding features, missing decisive families |
| RunDivergence | Optional field on completed runs: `judgeRemedyId`, `verdictOutcome`, `summary` — present when the Judge's remedy differs from the policy verdict |
| Replay | Optional run block (`stub`/`live` runs omit it): source run ID, recorded-at timestamp, source eval run name, playback speed — replay-mode runs only |
| RiskAssessment | Overall severity (low/medium/high), per-party signals (code, party, severity, detail, evidence citations), summary, fixed caveat literal, source (`model` or `deterministic`) |
| Precedent | ID, category, decided-at timestamp, origin (`seed`, `run`, `human_override`), ruling, remedyId, features (min 1), summary, optional source run ID |
| Escalation | Reasons (`low_confidence`, `high_risk`, `policy_divergence`, `policy_undetermined`; min 1), model-assessed confidence, threshold, summary — completed runs only, ruling stays a recommendation |
| Review | Decision (`confirmed`, `overridden`), decided-at, note, final ruling, server-built FinalAction — completed escalated runs only |
| ReviewRequest | Decision, optional remedyId (required for `overridden`), optional note (≤2000 chars, defaults to empty) |

Evidence `facts` is only a JSON envelope. Detailed GPS, chat, payment and history schemas belong to the partner and must be integrated through paired contract review. Current examples contain placeholders, not category datasets or demonstration policy thresholds.

Citation validation checks arguments, counterevidence, findings, and duplicate source IDs. Production policy applicability and monetary eligibility validation remain later Lane A work.

## Contract 0.2.0 Changes

- **JudgeModelResponse / JudgeResult split:** The Judge agent now returns only a `JudgeModelResponse` (ruling, findings, remedyId, confidence, reasoning, explanations). The server constructs the `FinalAction` (with amountCents, recipient, currency) and produces the complete `JudgeResult`. This prevents the model from generating monetary values.
- **New event types:** `model.start`, `model.finish`, `output.repair`, `run.incomplete` added to `ActivityEventSchema`.
- **Run payload expansion:** `retrievedEvidence` and `retrievedPolicies` arrays added to all Run variants, tracking per-role evidence and policy retrieval.
- **AdvocateResponseSchema:** New discriminated union for the tool protocol — `tool_request` or `final_case`.

## Contract 0.3.0 Changes

All additions are optional fields, so every 0.2.0 payload still validates unchanged.

- **New actors:** `risk` (the Risk Analyst agent) and `precedent` (precedent matching) added to `ActivityEventSchema.actor`.
- **New event types:** `risk.assessed`, `precedent.retrieved`, `run.escalated`, `review.decided`.
- **RiskAssessment / RiskSignal / RISK_CAVEAT:** deterministic, server-computed risk signals cited against evidence; the model may only write the summary (`source: 'model'`), otherwise `source: 'deterministic'`. The caveat is a fixed literal: context only — risk never establishes fault and never overrides trip evidence.
- **Precedent:** a recorded ruling used for consistency matching; origins are `seed` (synthetic seed file), `run` (an earlier run in the session) and `human_override` (a reviewer override).
- **Escalation:** present on a `completed` run when model-assessed confidence is below the configured threshold or risk overall is `high`. Status stays `completed`; the ruling and action are recommendations until reviewed.
- **Review:** the human decision on an escalated run — `confirmed` keeps the Judge's action; `overridden` carries a FinalAction rebuilt server-side for the chosen remedy.
- **ReviewRequest:** the request body for `POST /api/runs/:id/review`; `remedyId` is required exactly when `decision` is `overridden`.

## Contract 0.3.1 Changes

All additions are optional fields or widened enums, so every 0.3.0 payload still validates unchanged.

- **Mode `replay`:** `ModeSchema` gains a third value. A replay run re-emits the recorded events of a completed or incomplete live run — no model is called.
- **Replay block on Run:** `replay` carries `sourceRunId`, `recordedAt` (first recorded event timestamp), `sourceEvalRun` (the eval run directory name) and `speed`; replay-mode runs always set it.
- **`GET /api/runs`:** new listing endpoint (all modes) returning `{runs: [{id, fixtureId, mode, status, createdAt, remedyId, amountCents, escalated}]}`, newest first, capped at 50.

## Contract 0.3.2 Changes

All additions are optional fields or widened enums, so every 0.3.1 payload still validates unchanged.

- **PolicyVerdict on Run:** `verdict` carries the deterministic policy verdict computed from the case features and unavailable families — the outcome the demonstration policy dictates. Live and replay runs set it; a `verdict.computed` system event (actor `system`) records it before the workflow starts.
- **Escalation reasons:** `policy_divergence` (the Judge's remedy differs from the verdict) and `policy_undetermined` (the verdict cannot be determined from the available evidence) added. A completed run that carries `divergence` is always escalated; nothing is finalised against policy until a reviewer confirms or overrides. `divergence` records `judgeRemedyId`, `verdictOutcome` and a one-sentence summary.
- **Automatic re-run linkage:** `retryOf` (set on the automatic re-run) and `retriedBy` (set on the failed first attempt) plus the `run.retrying` event type. Any first-attempt workflow failure except `VERDICT_INVARIANT` or `REPLAY_INVALID` starts one new run for the same dispute; the second attempt never re-runs.

## Contract 0.3.3 Changes

All additions are optional fields or widened enums, so every 0.3.2 payload still validates unchanged.

- **Recovery event types:** `model.retry` (a call-level retry inside the adapter), `model.hedge` (a hedged duplicate request started or answered first) and `output.normalised` (a cosmetic model-output fault fixed without a repair round) added to `ActivityEventSchema.type`. They render in the emitting actor's lane like `output.repair`.
- **`requestedRemedyId` optional:** advocate cases may omit it; invalid values are normalised away rather than repaired. The field never gates money — the server builds the action from the Judge's remedy and the calculation provider.
- **Health model settings:** `GET /api/health` also returns `model: {provider, thinking, serviceTier}` — `provider` is `minimax` (host `*.minimax.io` or a `MiniMax*` model name) or `generic`; generic providers report `thinking: extra-body` because MODEL_THINKING/MODEL_SERVICE_TIER apply to MiniMax only.

## API

- `GET /api/health`: setup status, mode (`stub`/`live`/`replay`), contract version, model dependency status (`not_used_replay` in replay mode), `model: {provider, thinking, serviceTier}`; replay mode adds `replay: {sourceEvalRun, speed, fixtures}`.
- `GET /api/fixtures`: `{mode, notice, fixtures}`. Each descriptor includes `id`, `category`, `label`, `kind: contract_example`. Replay mode lists only fixtures that have a replay record.
- `POST /api/runs`: `{fixtureId, riderClaim?}`; `202` response `{id, mode, status: queued}`. Unknown fixture returns `404` (also when a fixture has no replay record); invalid body returns `400`. A workflow failure on the first attempt — other than an internal `VERDICT_INVARIANT`/`REPLAY_INVALID` failure — may produce a linked follow-up run: the original ends `failed` with `retriedBy`, and the new run carries `retryOf` — follow the link to observe the retried outcome.
- `GET /api/runs`: `{runs}` — newest first, cap 50; each entry carries `id`, `fixtureId`, `mode`, `status`, `createdAt`, `remedyId`/`amountCents` (null unless completed) and `escalated`.
- `GET /api/runs/:id?after=sequence`: Run payload with only events whose sequence is greater than `after`, plus status and result/error when present. `after` defaults to `0` and must be a nonnegative safe integer. Unknown run returns `404`.
- `GET /api/precedents`: `{count, precedents}` — the session precedent store (synthetic seed plus appended run and override rulings). Live mode only; stub mode returns `count: 0`.
- `POST /api/runs/:id/review`: body `ReviewRequest`. `200` returns the full updated run including the `review.decided` event; `400` invalid body; `404` unknown run; `409` when the run is not completed, not escalated, already reviewed, or in stub mode; `422` when the override remedy cannot produce a valid action for the case.

Poll once per second. Deduplicate by sequence. Stop on `completed`, `failed` or `incomplete`. A completed **stub** means fixed integration output is available, not a live ruling. All stub events and runs carry `mode: stub`; no tool-request/retrieval event is fabricated.

## Custom workflow foundation

`@fairtrip/agents` 0.2.0 contains provider-independent `ModelAdapter`, dispute-bound `EvidenceTools`, `WorkflowRoles`, `WorkflowEventEmitter`, and `runWorkflow`. Both advocates start independently, return schema/citation-validated cases, then the Judge receives both cases. Invalid advocates prevent Judge execution. The event emitter emits public case/handoff events for immediate persistence.

The runtime connector currently supports nonstreaming OpenAI-compatible chat-completions HTTP requests using Node fetch. It never logs request headers, response bodies, or keys; redirects are rejected. Model requests have a 20-second timeout. Framework constants retain two tool rounds, one repair attempt, and a 90-second run deadline for the later live tool loop. Actual prompts, native tool integration, evidence calculations, retries, and live adjudication are outside this prerequisite scaffold.

Run `npm run check:examples` to validate the catalog, standalone `examples/run.json` and `examples/final-action.json`, and both categories. Tests validate malformed contracts, invented citations, workflow ordering, invalid advocate output, cancellation, API cursors/concurrency, and configuration/provider errors.
