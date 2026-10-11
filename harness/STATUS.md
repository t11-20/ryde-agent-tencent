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
| LB-06 | Fare check and remedy basis | LB-05 | DONE | | 32 new tests (fare anomalies + remedy basis) pass; 172 total; typecheck clean |
| LB-06A | Formula functions, no hand calculations | LB-06 | DONE | | `formulas.ts` copied from SPEC §5.10; route/fare/remedy call the named formulas (no inline copies); 7 new tests, 179 total; audit RESULT: OK (68 passed, 2 skips = LB-07/LB-08) |
| LB-07 | Evidence builder and policy clauses | LB-06 | TODO | | |
| LB-08 | Dispute source (integration seam) | LB-07 | TODO | | Lane A file touched: agents index |
| LB-09 | Connect the fixture source to the live API | LB-08 | TODO | | Lane A files touched: app, live-roles, server |
| LB-10 | Golden flow for all 11 fixtures | LB-09 | TODO | | |
| LB-11 | Real model connection and output hardening | LB-10 | TODO | | Model latency: … ms · R1 smoke: … · N2 smoke: … |
| LB-12 | Web foundation | LB-09 | TODO | | |
| LB-13 | Web UI screen | LB-12 | TODO | | |
| LB-14 | Evaluation runner and scorecard | LB-10 | TODO | | |
| LB-15 | Live acceptance with the real model | LB-11, LB-13, LB-14 | TODO | | Golden: … / 6 · Gate: … |
| LB-16 | Documentation and submission package | LB-15 | TODO | | |

## Gates

| Gate | Condition | Status |
|---|---|---|
| G1 | Golden numbers reproduced (LB-04 to LB-07) | |
| G2 | Live API serves Lane B data; Lane A tests still pass (LB-09) | |
| G3 | Real model completes R1 (LB-11) | |
| G4 | Release gate passes with the real model (LB-15) | |
| G5 | Submission package complete; fresh clone verifies (LB-16) | |

## Blockers

None. Format: `LB-xx — first error line — what was tried — what is needed`.
