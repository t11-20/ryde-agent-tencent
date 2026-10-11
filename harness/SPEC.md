# FairTrip Lane B — specification index

The specification is split into one file per section so you read only what your task card lists. These files are authoritative for Lane B: if a task card and a spec file disagree, the spec wins; report the conflict. All numbers in §7 were computed from the data files in `harness/data/` and must be reproduced exactly.

| Section | Title | File | Subsections |
|---|---|---|---|
| §1 | Integration design | `harness/spec/01-integration-design.md` | — |
| §2 | Lane A interfaces you consume | `harness/spec/02-lane-a-interfaces.md` | §2.1, §2.2, §2.3, §2.4 |
| §3 | Repository layout after Lane B | `harness/spec/03-repository-layout.md` | — |
| §4 | Data files | `harness/spec/04-data-files.md` | §4.1, §4.2, §4.3, §4.4 |
| §5 | Calculations | `harness/spec/05-calculations.md` | §5.1, §5.2, §5.3, §5.4, §5.5, §5.6, §5.7, §5.8, §5.9, §5.10 |
| §6 | Evidence catalogue | `harness/spec/06-evidence-catalogue.md` | §6.1, §6.2, §6.3, §6.4 |
| §7 | Golden values (computed from the data files; tests must match exactly) | `harness/spec/07-golden-values.md` | — |
| §8 | Dispute source (the integration seam) | `harness/spec/08-dispute-source.md` | — |
| §9 | API behaviour after wiring (LB-09, LB-11) | `harness/spec/09-api-behaviour.md` | — |
| §10 | Scripted model (test double, tests only) | `harness/spec/10-scripted-model.md` | — |
| §11 | Evaluation runner (`packages/eval`) | `harness/spec/11-evaluation-runner.md` | §11.1, §11.2, §11.3, §11.4 |
| §12 | Web UI (`apps/web`) | `harness/spec/12-web-ui.md` | §12.1, §12.2, §12.3 |
| §13 | Labelling and honesty rules | `harness/spec/13-labelling-and-honesty-rules.md` | — |

When a card says "SPEC §5.4", open the file for §5 and go to the heading `### 5.4`.
