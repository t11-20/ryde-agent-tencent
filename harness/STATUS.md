# Lane B status

Status values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED`. The agent updates its own row when it finishes a task. Commit hashes may be filled in by the next task.

| ID | Task | Requires | Status | Commit | Notes |
|---|---|---|---|---|---|
| LB-00 | Setup and baseline | — | DONE | | Node v22.23.3 / npm 10.9.9; baseline `npm run verify` passes with 67 tests, examples validated, foundation verified. Earlier blockers (version mismatch, then host-wide NTFS mount-point traversal breaking workspace resolution) are both fixed — see Blockers for the environment note |
| LB-01 | Evidence workspace and root wiring | LB-00 | TODO | | |
| LB-02 | Data files, schemas and dataset loader | LB-01 | TODO | | |
| LB-03 | Geo, money and time helpers | LB-02 | TODO | | |
| LB-04 | GPS metrics: route and pickup | LB-03 | TODO | | |
| LB-05 | Chat and call analysis | LB-04 | TODO | | |
| LB-06 | Fare check and remedy basis | LB-05 | TODO | | |
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

Resolved while doing LB-00, kept here as environment context for later cards: this Windows host initially refused to traverse NTFS mount points ("The path cannot be traversed because it contains an untrusted mount point"), so the npm workspace junctions under `node_modules/@fairtrip/*` could not be resolved and every `@fairtrip/*` import failed with TS2307 / `ERR_MODULE_NOT_FOUND`. The junctions themselves were always valid (fsutil tag `0xa0000003`, correct targets), a junction created outside the repo failed identically, no ancestor folder was a reparse point, and Defender controlled folder access was off — the block was machine-wide and pointed at **Trend Micro Maximum Security**. Allowing reparse/mount-point traversal there fixed it; `npm run verify` then passed with 67 tests. If workspace imports ever break again, suspect that policy first, not the repo.
