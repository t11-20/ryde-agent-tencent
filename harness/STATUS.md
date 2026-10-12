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
| LB-11 | Real model connection and output hardening | LB-10 | DONE | 60219c7 | Model latency: 1616 ms · R1 smoke: `RESULT completed: refund_route_excess, 198 cents, ruling rider_favored, confidence 0.92` · N2 smoke: `RESULT completed: keep_charge, 0 cents, ruling driver_favored, confidence 0.92` · blocker resolved by LB-11A (42f32ef) + LB-11B (66d338c); typecheck clean, 266/266 tests pass |
| LB-11A | MiniMax compatibility: user message in every request | LB-10 | DONE | 42f32ef | Step 8 passed after LB-11B (66d338c): R1 `RESULT completed: refund_route_excess, 198 cents, ruling rider_favored, confidence 0.93`; N2 `RESULT completed: keep_charge, 0 cents, ruling driver_favored, confidence 0.95` |
| LB-11B | MiniMax-M3 advocate output fails schema (counterevidence) | LB-11A | DONE | 66d338c | Cause (probe evidence): every MiniMax call returned HTTP 200 in 1.1–10.0 s with finish_reason=stop and valid JSON; both advocates requested both tools in round 1; the round-2 `final_case` failed `AdvocateCaseSchema` only because `counterevidence` items were plain strings (rider 3, driver 5 issues `case.counterevidence.N: expected object, received string`), and the generic repair prompt produced the same strings again. The advocate prompts showed `"counterevidence": [...]` without its shape. Fix: append-only `COUNTEREVIDENCE_RULE` at the end of both advocate prompts (`packages/agents/src/prompts.ts`, Lane A — partner review) stating each item is a `{claim, evidenceIds, policyClauseIds}` object, `[]` if none. Regression: 2 new tests in `tests/integration/provider-compat.test.ts` (MiniMax-M3-style fake model, R1 and N2; fail before the fix with the live error, pass after); 266 tests pass; typecheck/build clean; check-golden RESULT: OK · Live smokes after API restart: R1 `RESULT completed: refund_route_excess, 198 cents, ruling rider_favored, confidence 0.93`; N2 `RESULT completed: keep_charge, 0 cents, ruling driver_favored, confidence 0.95` |
| LB-12 | Web foundation | LB-09 | DONE | b1d8b41 | Web package scaffolded (Vite 8 + React 19, tsconfig, index.html, temporary main.tsx); `src/lib` api client (`ContractMismatchError`/`NetworkError`, `RunSchema` parsing), events merge, view-model, export, format labels (§12.2); 28 web tests pass; root `verify:web`/`dev:web` scripts added; root typecheck clean, 266/266 tests pass |
| LB-13 | Web UI screen | LB-12 | DONE | | Single screen per SPEC §12.1/§12.3: 3-column grid (360px/1fr/380px) + full-width evidence (GPS/Chat/Payment/History) and policy rows; 12 components + `useFixtures`/`useRunPolling` (copied verbatim) hooks; every §12.2 state has distinct text; chips scroll+highlight (1.5 s); export via `buildExport`/`downloadJson`; README demo operator script added; `verify:web` and full `verify` pass (28 web + 266 root tests); manual stub/live checks and the screenshot moment handed to the human |
| LB-14 | Evaluation runner and scorecard | LB-10 | TODO | | |
| LB-15 | Live acceptance with the real model | LB-11, LB-13, LB-14 | TODO | | Golden: … / 6 · Gate: … |
| LB-16 | Documentation and submission package | LB-15 | TODO | | |

## Gates

| Gate | Condition | Status |
|---|---|---|
| G1 | Golden numbers reproduced (LB-04 to LB-07) | MET (check-golden: 93 passed, 0 failed, 0 skips — LB-08 built) |
| G2 | Live API serves Lane B data; Lane A tests still pass (LB-09) | MET (247 tests pass: 67 Lane A + 6 new api-source integration; R1 completes with refund_route_excess 198 cents; X1 ends incomplete on missing gps) |
| G3 | Real model completes R1 (LB-11) | MET (live smoke R1 `completed: refund_route_excess, 198 cents, ruling rider_favored, confidence 0.92`; N2 `completed: keep_charge, 0 cents`; check:model 1616 ms) |
| G4 | Release gate passes with the real model (LB-15) | |
| G5 | Submission package complete; fresh clone verifies (LB-16) | |

## Blockers

None. Format: `LB-xx — first error line — what was tried — what is needed`.
