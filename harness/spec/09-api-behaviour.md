# SPEC §9. API behaviour after wiring (LB-09, LB-11)

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

- `npm run dev` reads `.env`. `RUN_MODE=live` makes `server.ts` call `createApp(config, undefined, createFixtureSource())`.
- Live `GET /api/fixtures` → `{ mode: 'live', notice, fixtures: FixtureListing[] (11) }`.
- Live `POST /api/runs {fixtureId: 'R1'}` → `202`; unknown fixture → `404`. The run's `fixtureId` is the requested ID (`R1`), its `dispute.id` is `DSP-R1`.
- After both advocates and the Judge finish, the server checks `missingDecisiveEvidence`. If it is not empty, the run ends `incomplete` with `missingEvidence` equal to that list and a `run.incomplete` event whose summary begins `Decisive evidence unavailable`. No result and no money.
- Otherwise Lane A's normal path applies, using Lane B's `CalculationProvider`. The `run.completed` summary says the run used SYNTHETIC fixtures, DEMONSTRATION POLICY and deterministic calculations.
- LB-11A makes the model adapter add a neutral kickoff user message to any request that has none (MiniMax rejects system-only requests with error 2013) and append up to 200 characters of the provider's error text to `Model request failed (HTTP …)` errors.
- LB-11 adds `MODEL_EXTRA_BODY` (a JSON object merged into every model request, for example `{"reasoning_split":true}` for MiniMax-M3) and `extractJsonText`, which strips `<think>` blocks and code fences before JSON parsing.
