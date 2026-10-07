# Lane B status

Last updated: 2026-10-07 (post-Phase 6 integration prep).

| Item | Plan ref | Done when | Status | Evidence |
|---|---|---|---|---|
| Demonstration policy, versioned and labelled | 6.2 | `demo-policy.v1.json` committed; calculations read their params from it | DONE | `packages/evidence/data/policy/demo-policy.v1.json` (verbatim, `label: "DEMONSTRATION POLICY"`); `src/calc/params.ts`; tests `route.test.ts` / `pickup.test.ts` assert the params come from the file |
| Fixtures for both categories, golden plus robustness | M7, 12.1, 12.2 | 12 fixtures generated deterministically; `fixtures:check` passes | DONE | `data/fixtures/*.json` from `scripts/lib/fixtures.ts`; `npm run fixtures:check` passes |
| All four evidence families retrievable | M6 | `get_evidence` returns gps, chat, payment and history records, or explicit `unavailable` | DONE | `dataset.test.ts` ("all four families", X1 gps / X3 payment `unavailable`); `examples/get_evidence.X1.gps.json` |
| Deterministic route, wait and fare calculations | 6.1, 6.3 | Section 6.5 reference values reproduced exactly; boundary tests pass | DONE, ONE DISCREPANCY | `reference.test.ts`: every 6.5 value reproduced exactly **except N3's wait, which is 225 s, not 210 s** (spec-internal inconsistency; decision recorded in `INTEGRATION.md`: keep the exact rules; the outcome is unchanged). Boundary tests: `route.test.ts`, `pickup.test.ts`, `money.test.ts` |
| Tool binding to the active dispute | 5 | Tests show no cross-dispute access and strict argument validation | DONE | `tools.unit.test.ts` (unknown source, extra keys, empty, dedupe, unknown dispute, no other dispute's data); `dataset.test.ts` (provenance = bound fixture) |
| Remedy basis for Lane A's validator | 6.3 | `getRemedyBasis`: integer cents, caps and null-on-missing tested | DONE | `fare.test.ts` (surge, distance and paid caps; broken fare → null; missing inputs → null with reason) |
| Examples handed to Lane A | 11 | `examples/*.json` committed | DONE | `packages/evidence/examples/` (8 files); drift checked by `verify.sh` |
| Observable single-screen UI | M5, M8, 8 | Gate 3 passes; mock runs clearly labelled | DONE | `apps/web` (29 tests); headless Chromium at 1920×1080 played R1, N2, X1, timeout and unknown-citation mock runs in the correct states, with no page errors |
| Trace export | 8 | Export JSON contains the full case and trace | DONE | `apps/web/src/components/exportRun.ts`; `export.test.ts` |
| Evaluation runner and scorecard | 12 | Gate 4 passes; release gate implemented | DONE | `packages/eval` (44 tests against an in-process fake API and the contract examples); `npm run eval:demo` writes a labelled scorecard. **Real-model runs not yet done** (needs Lane A + API key) |
| Evidence and calculation audit | Day 3 | `EVIDENCE_AUDIT.md` generated | DONE | `docs/lane-b/EVIDENCE_AUDIT.md` (`npm run audit`) |
| Submission drafts | E3–E6 | identity, description, checklist and screenshot guide drafted | DRAFTED | `submission/` (the human finalises; metrics are `[[FROM SCORECARD: …]]` placeholders) |
| Zero-conflict branch | 11 | Ownership and `merge-tree` checks pass at every gate | DONE (so far) | Checks run before every push; no Lane A branch exists yet to test against |

| Integration hand-off to Lane A | 11 | Lane A can build against documented, tested contracts | DONE | `docs/lane-b/LANE_A_GUIDE.md`; `docs/lane-b/contracts/` (JSON Schemas + example responses, drift-checked) |

## Open items

- Lane A contract confirmation: see `CONTRACT_REQUESTS.md` (all OPEN). No Lane A branch exists on the remote yet.
- Replace provisional contracts with Lane A's package at integration.
- Real-model eval runs and the release gate against Lane A's backend (human task).
