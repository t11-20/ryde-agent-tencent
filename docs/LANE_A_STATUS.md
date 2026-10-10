# Lane A Status Record — FairTrip

**Last updated:** 2026-10-11 (Asia/Kuala_Lumpur)
**Current branch:** `lane-a`
**Published baseline:** `37c7506` on `origin/lane-a`
**Current audit:** restored Lane A portions of the saved CodeBuddy work and corrected defects found during verification. See `git log -1` for the local audit commit.
**Release status:** Local verification passes; real-model verification is deferred at the user's request; shared release acceptance remains pending.

## Scope and preserved work

Lane A stays separate from Lane B. The ten original Lane A commits are retained. CodeBuddy's later live-mode callbacks, model bootstrap, and live-wiring tests were recovered from stash `742bf388fd1b38e77a8c976c022a66ff1169386a` and adapted to Lane A's synthetic examples without importing Lane B packages.

The integrated history remains on local branch `codex/lane-a-b-integration-backup-20261010` at `8e942b0`; the original stash and generated integration reports remain available. Integration-only adapters and fixtures are not part of the current Lane A branch. This audit updates the local repository; the last published branch remains at the baseline above.

## Package status

| Package | Verified state | Remaining work |
|---|---|---|
| CB-00: foundation | Complete; Lane A history and GitHub branch exist | None for the local foundation |
| CB-01: contracts | Contract 0.2.0 schemas and examples pass | Paired review and shared contract freeze |
| CB-02: advocates | Tool protocol, two request rounds plus final output, one syntax/schema repair, independent retrieval and per-role citation checks pass with mocked model responses | Authenticated provider acceptance and adversarial tests |
| CB-03: API/orchestration | Live callbacks restored; Judge receives both cases and retrieved source union; sibling cancellation, 90-second terminal deadline and incomplete/no-action handling verified | Real provider run and Lane B adapter/calculation integration |
| CB-04: validation | 67 automated tests pass, including the added regressions | Prompt-injection and changed-history acceptance are not established by the existing tests |
| CB-05: integration | Previous combined work is preserved in the backup | Reconcile contracts and verify pinned lanes on `ryde-integration`; current Lane A intentionally remains separate |
| CB-06: documentation | Setup, architecture, readiness and this record updated to observed results | Add real model/golden measurements and genuine development evidence |
| CB-07: release | Fresh dependency install and source verification tested | Approved candidate, both sign-offs, release PR and archived release evidence |

## Changes verified in this audit

- Restored CodeBuddy's live wiring as `apps/api/src/live-roles.ts`, using Lane A's labeled synthetic evidence and mock calculations.
- Ensured each live advocate requests both evidence and policy and cites only its own retrieved records; the Judge receives the deduplicated union and both validated cases.
- Added one directed Judge output repair; provider outages fail visibly without substituting stub output.
- Corrected tool-round accounting so two tool requests can be followed by a final case; the one output repair does not consume a tool round.
- Implemented actual sibling cancellation and a terminal failed state at the 90-second deadline, including for an adapter that ignores cancellation.
- Kept incomplete live rulings free of a result/action, and passed the authoritative dispute category into monetary validation instead of relying on evidence ID prefixes.
- Restored CodeBuddy model bootstrap with explicit-environment precedence and matching-provider checks. Raw model text is omitted from parse-failure diagnostics; the startup message reports the selected mode.

## Observed verification results

| Check | Result |
|---|---|
| Original Lane A baseline | `npm run verify`: 48 tests passed |
| Updated local Lane A | `npm run verify`: 67 tests across 9 files passed; strict typecheck, all implemented package builds, examples and setup checks passed |
| Fresh dependency install | `npm ci --ignore-scripts --no-audit --no-fund` passed in an isolated clean source copy with the root lockfile |
| Fresh source verification | Final clean source: 67 tests across 9 files, strict typecheck, builds, examples and setup checks passed |
| Development server | `npm run dev` started on an isolated port in stub mode; health, fixture listing, route/no-show runs and event polling passed |
| Live model connectivity | `npm run check:model` reached the configured MiniMax endpoint and failed with **HTTP 401**. The runtime key matches the private CodeBuddy model settings. No further credential investigation or provider requests will be made: the user asked to ignore model credentials for now |
| Real live adjudication | Not verified; deferred at the user's request to ignore model credentials for now |

The automated live-mode tests inject scripted model responses. They verify actual callback/tool/controller execution, not real model quality. Current live wiring uses synthetic contract examples and mock monetary calculations; it is not golden-case or real-payment acceptance.

## Pending Lane A work

| Pending item | Owner | Completion evidence |
|---|---|---|
| Real model verification (deferred) | Lane A / account owner | Deferred at the user's request to ignore model credentials for now. When resumed, require successful connectivity and authenticated three-agent smoke tests |
| Run authenticated three-agent smoke tests | Lane A | Both advocates independently retrieve evidence/policy; Judge validates; terminal outcome, timings, citations and actions recorded without raw private reasoning |
| Complete adversarial and fairness acceptance | Lane A | Tests using injection-like evidence and genuinely changed historical profiles. The existing history test repeats the same inputs and cannot establish invariance under profile changes |
| Agree and freeze the shared contracts | Both | Resolve the open Lane B requests, including `id` versus `runId`, event names/actors, ruling vocabulary, evidence/policy fields and tool-error handling; both approve the same schema revision |
| Complete backend integration and golden acceptance | Lane A + Lane B | On a separate `ryde-integration` candidate, consume Lane B fixtures, evidence and calculation interfaces; verify UI polling plus R1/N2, missing evidence, injection/history cases and the shared release gate |
| Capture genuine CodeBuddy development evidence | Lane A / shared submission | At least three readable development-chat captures across project checkpoints, with captions. Only `00-project-open.png` is currently archived; it does not count as a development-chat capture |
| Complete technical release review | Both | Partner verification, pinned candidate and component versions, measured real results, both sign-offs, reviewed release PR and archived release commit/evidence |

Lane B source availability is no longer the blocker: `origin/lane-b` exists at `e2ad1e3`. The remaining integration work is interface alignment and acceptance on the separate integration branch, while Lane A stays independently publishable.
