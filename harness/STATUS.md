# Lane B status

Status values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED`. The agent updates its own row when it finishes a task. Commit hashes may be filled in by the next task.

| ID | Task | Requires | Status | Commit | Notes |
|---|---|---|---|---|---|
| LB-00 | Setup and baseline | — | DONE | 1c9b130, d31805e | Node v22.23.3 / npm 10.9.9; baseline `npm run verify` passes with 67 tests, examples validated, foundation verified |
| LB-01 | Evidence workspace and root wiring | LB-00 | DONE | 96fc51e | 10 test files / 68 tests pass (67 Lane A + smoke); typecheck, build, check:examples pass |
| LB-02 | Data files, schemas and dataset loader | LB-01 | DONE | 8a37f6c | 13 data files copied byte-identical; 11 fixtures + 11 policy clauses validate; 11 test files / 74 tests pass |
| LB-03 | Geo, money and time helpers | LB-02 | DONE | 32a314b | geo/money/time helpers added; 9 new tests pass (incl. R1 reference route = 7956 m); 83 total; typecheck clean |
| LB-04 | GPS metrics: route and pickup | LB-03 | DONE | 5a878ee | 23 new tests (route+pickup) pass; 106 total; typecheck clean |
| LB-05 | Chat and call analysis | LB-04 | DONE | 5ea6805 | 34 new tests (chat tags, sentiment, contact attempts) pass; 140 total; typecheck clean |
| LB-06 | Fare check and remedy basis | LB-05 | DONE | fb743e4 | 32 new tests (fare anomalies + remedy basis) pass; 172 total; typecheck clean |
| LB-06A | Formula functions, no hand calculations | LB-06 | DONE | 3af6a18 | `formulas.ts` copied from SPEC §5.10; route/fare/remedy call the named formulas (no inline copies); 7 new tests, 179 total; audit RESULT: OK (68 passed, 2 skips = LB-07/LB-08) |
| LB-07 | Evidence builder and policy clauses | LB-06 | DONE | d33b729 | facts/policy/build-evidence added; 49 new tests pass, 228 total; typecheck clean; audit RESULT: OK (87 passed, 1 skip = LB-08) |
| LB-08 | Dispute source (integration seam) | LB-07 | DONE | | Lane A file touched: `agents/src/index.ts` (additive only — ask Edward to review); `createFixtureSource` + `DisputeSource`/`FixtureListing` seam; 13 new source tests, 241 total (67 Lane A intact); typecheck clean; audit RESULT: OK (93 passed, 0 failed, 0 skips) |
| LB-09 | Connect the fixture source to the live API | LB-08 | DONE | | Lane A files touched: app, live-roles, server (exactly the card's edits); `predev` build script added; live mode serves Lane B fixtures/evidence/policy/money via `createFixtureSource`; decisive-evidence guard ends runs `incomplete`; scripted model (SPEC §10) + 6 new integration tests, 247 total (67 Lane A intact); typecheck/build/check:examples clean |
| LB-10 | Golden flow for all 11 fixtures | LB-09 | DONE | | 11 golden-flow integration tests (scripted model, no network): status/remedy/amount, trace shape, family coverage, citations; 258 total pass; file runs ~0.8 s; typecheck clean |
| LB-11 | Real model connection and output hardening | LB-10 | BLOCKED | 60219c7 (A1–A9) | Model latency: 2718 ms (recheck 1695 ms) · After LB-11A fix (42f32ef): HTTP 400/2013 gone, model calls + tool calls + evidence retrieval work · R1 smoke: `RESULT failed: WORKFLOW_FAILED Advocate rider produced unparseable output after 1 repair attempts` · N2 smoke: `RESULT failed: WORKFLOW_FAILED The operation was aborted due to timeout` (per-call abort during repair) · A1–A9 committed, 261 tests pass; see Blockers |
| LB-11A | MiniMax compatibility: user message in every request | LB-10 | BLOCKED | 42f32ef | Code fix DONE and committed: ensureUserMessage kickoff + provider error text; provider-compat tests (3 new, 264 total pass); typecheck/build clean · Step 8 smoke failed (not HTTP 400): R1 unparseable output after repair, N2 per-call timeout — needs human `.env` change per LB-11 troubleshooting, see Blockers |
| LB-12 | Web foundation | LB-09 | TODO | | |
| LB-13 | Web UI screen | LB-12 | TODO | | |
| LB-14 | Evaluation runner and scorecard | LB-10 | TODO | | |
| LB-15 | Live acceptance with the real model | LB-11, LB-13, LB-14 | TODO | | Golden: … / 6 · Gate: … |
| LB-16 | Documentation and submission package | LB-15 | TODO | | |

## Gates

| Gate | Condition | Status |
|---|---|---|
| G1 | Golden numbers reproduced (LB-04 to LB-07) | MET (check-golden: 93 passed, 0 failed, 0 skips — LB-08 built) |
| G2 | Live API serves Lane B data; Lane A tests still pass (LB-09) | MET (247 tests pass: 67 Lane A + 6 new api-source integration; R1 completes with refund_route_excess 198 cents; X1 ends incomplete on missing gps) |
| G3 | Real model completes R1 (LB-11) | |
| G4 | Release gate passes with the real model (LB-15) | |
| G5 | Submission package complete; fresh clone verifies (LB-16) | |

## Blockers

`LB-11 — RESULT failed: WORKFLOW_FAILED Advocate rider produced unparseable output after 1 repair attempts (R1); RESULT failed: WORKFLOW_FAILED The operation was aborted due to timeout (N2) — LB-11A fix (42f32ef) resolved the HTTP 400/2013 system-only rejection: every model request is now accepted and both runs reach tool calls and evidence retrieval, but both advocates emit output.repair events; N2's repair call hit the 20-second per-call abort — Tried: LIVE server restarted with LB-11A code; R1 and N2 smoke each run once — Needed: human to add "thinking":{"type":"disabled"} to MODEL_EXTRA_BODY in .env (LB-11 troubleshooting: per-call aborts = MiniMax-M3 thinking too long), restart the server, then the agent retries the smokes; STOP if it still times out.`

Format: `LB-xx — first error line — what was tried — what is needed`.
