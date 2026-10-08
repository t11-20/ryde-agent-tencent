# Shared interfaces — version 0.1.0

Import schemas and inferred types from `@fairtrip/contracts`. One backend/browser contract source prevents divergence. Both lanes must review changes and update examples together before freezing the interface.

| Contract | Required data |
|---|---|
| Dispute | ID, category (`route_deviation` or `no_show`), trip ID, rider claim, driver statement |
| Evidence | ID, source family, ISO timestamp, JSON facts, provenance |
| PolicyClause | ID, version, category, rule text, remedy criteria |
| AdvocateCase | Side, summary, arguments with evidence/policy IDs, counterevidence, requested remedy, missing facts |
| JudgeResult | Ruling, cited findings, remedy, confidence 0–1, reasoning, both explanations, FinalAction |
| FinalAction | Remedy, recipient, SGD currency, safe integer cents, recommendation; keep_charge requires zero and no recipient |
| ActivityEvent | Run ID, increasing sequence, ISO timestamp, mode, actor, type, summary, citation IDs |
| Run | ID, fixture ID, mode, dispute, cases, events, discriminated status and result/error/missing-evidence payload |

Evidence `facts` is only a JSON envelope. Detailed GPS, chat, payment and history schemas belong to the partner and must be integrated through paired contract review. Current examples contain placeholders, not category datasets or demonstration policy thresholds. Citation validation checks arguments, counterevidence, findings, and duplicate source IDs; production policy applicability and monetary eligibility validation remain later Lane A work.

## API

- `GET /api/health`: setup status, stub mode, contract version, model dependency status.
- `GET /api/fixtures`: `{mode, notice, fixtures}`. Each descriptor includes `id`, `category`, `label`, `kind: contract_example`.
- `POST /api/runs`: `{fixtureId, riderClaim?}`; `202` response `{id, mode: stub, status: queued}`. Unknown fixture returns `404`; invalid body returns `400`.
- `GET /api/runs/:id?after=sequence`: Run payload with only events whose sequence is greater than `after`, plus status and result/error when present. `after` defaults to `0` and must be a nonnegative safe integer. Unknown run returns `404`.

Poll once per second. Deduplicate by sequence. Stop on `completed`, `failed` or `incomplete`. A completed **stub** means fixed integration output is available, not a live ruling. All stub events and runs carry `mode: stub`; no tool-request/retrieval event is fabricated.

## Custom workflow foundation

`@fairtrip/agents` 0.1.0 contains provider-independent `ModelAdapter`, dispute-bound `EvidenceTools`, `WorkflowRoles`, and `runWorkflow`. Both advocates start independently, return schema/citation-validated cases, then the Judge receives both cases. Invalid advocates prevent Judge execution. Hooks emit public case/handoff events.

The runtime connector currently supports nonstreaming OpenAI-compatible chat-completions HTTP requests using Node fetch. It never logs request headers, response bodies, or keys; redirects are rejected. Model requests have a 20-second timeout. Framework constants retain two tool rounds, one repair attempt, and a 90-second run deadline for the later live tool loop. Actual prompts, native tool integration, evidence calculations, retries, and live adjudication are outside this prerequisite scaffold.

Run `npm run check:examples` to validate the catalog, standalone `examples/run.json` and `examples/final-action.json`, and both categories. Tests validate malformed contracts, invented citations, workflow ordering, invalid advocate output, cancellation, API cursors/concurrency, and configuration/provider errors.
