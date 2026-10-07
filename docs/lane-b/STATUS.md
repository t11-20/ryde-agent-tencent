# Lane B status

| Item | Plan ref | Done when | Status | Evidence |
|---|---|---|---|---|
| Demonstration policy, versioned and labelled | 6.2 | `demo-policy.v1.json` committed; calculations read their params from it | TODO | |
| Fixtures for both categories, golden plus robustness | M7, 12.1, 12.2 | 12 fixtures generated deterministically; `fixtures:check` passes | TODO | |
| All four evidence families retrievable | M6 | `get_evidence` returns gps, chat, payment and history records, or explicit `unavailable` | TODO | |
| Deterministic route, wait and fare calculations | 6.1, 6.3 | Section 6.5 reference values reproduced exactly; boundary tests pass | TODO | |
| Tool binding to the active dispute | 5 | Tests show no cross-dispute access and strict argument validation | TODO | |
| Remedy basis for Lane A's validator | 6.3 | `getRemedyBasis`: integer cents, caps and null-on-missing tested | TODO | |
| Examples handed to Lane A | 11 | `examples/*.json` committed | TODO | |
| Observable single-screen UI | M5, M8, 8 | Gate 3 passes; mock runs clearly labelled | TODO | |
| Trace export | 8 | Export JSON contains the full case and trace | TODO | |
| Evaluation runner and scorecard | 12 | Gate 4 passes; release gate implemented | TODO | |
| Evidence and calculation audit | Day 3 | `EVIDENCE_AUDIT.md` generated | TODO | |
| Submission drafts | E3–E6 | identity, description, checklist and screenshot guide drafted | TODO | |
| Zero-conflict branch | 11 | Ownership and `merge-tree` checks pass at every gate | IN PROGRESS | Gate 0 |
