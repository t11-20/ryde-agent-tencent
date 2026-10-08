# Lane A Execution Brief — FairTrip

**Project:** FairTrip — Ryde Multi-Agent Dispute Resolution Prototype
**Owner:** Lane A (Edward)
**Collaboration repository:** https://github.com/t11-20/ryde-agent-tencent.git
**Local workspace:** /Users/edward/Documents/ChatGPT/Tencent
**Foundation commit:** ea37153
**Current branch:** lane-a

---

## 1. Scope and Ownership

### Lane A owns
- Model adapter and connectivity
- Role prompts (Rider Advocate, Driver Advocate, Judge)
- Advocate execution with tool loops
- Judge orchestration and context assembly
- Backend event emission and persistence
- Citation and remedy validation
- Technical documentation (architecture, setup, prompts, metrics)
- Technical release review

### Lane B owns
- Evidence adapters and synthetic fixtures
- GPS/wait/fare calculations
- Frontend (React/Vite)
- Golden evaluation tooling and scorecard
- Submission assembly (title, blurb, presentation, cover, screenshots)

### Shared
- Contract revision and freeze (both review)
- Integration testing on `ryde-integration`
- Release sign-off (both approve exact commit)

---

## 2. Branch Rules

| Branch | Purpose | Rule |
|---|---|---|
| `main` | Release history | Never commit or push directly. Only merge via reviewed PR. |
| `lane-a` | Lane A source and technical docs | All Lane A work originates here. |
| `lane-b` | Partner work | Lane B owns this branch. |
| `ryde-integration` | Combined testing | Merge pinned lane commits. Resolve fixes on owning lane. |

- Preserve existing work and Git history. Do not force-push.
- CodeBuddy commits locally only. User pushes to GitHub manually.

---

## 3. Execution Package Order

| Package | Timing | Purpose | Gate |
|---|---|---|---|
| CB-00 | Day 1 | Git foundation, scaffold committed | Foundation SHA recorded, lane-a created |
| CB-01 | Day 1 | Contract revision 0.2.0 | Schemas/examples/tests pass validation |
| CB-02 | Days 1–2 | Independent advocate tool execution | Deterministic mocked tests pass |
| CB-03 | Day 2 | Orchestration, Judge, actions, API | Mocked integration passes, live gate pending |
| CB-04 | Days 2–3 | Validation and failure coverage | Mandatory correctness gate passes |
| CB-05 | Daily checkpoints | Integration with Lane B | Combined verification at pinned commits |
| CB-06 | Day 4 | Technical documentation and demo support | Assets review-ready |
| CB-07 | Day 5 | Final release | Approved release at exact commit |

---

## 4. Persistent Rules

### Implementation
- Inspect the actual repository before editing. Reuse the existing setup.
- Preserve explicit stub/live modes. Never substitute stub output for a failed live run.
- Each advocate must independently request evidence and policy.
- The Judge receives both validated cases and retrieved source records.
- The model selects remedy identifiers; the server constructs monetary actions from validated partner calculations.
- Enforce two tool-request rounds per advocate, one directed output repair per role, a 20-second model-request ceiling, and a 90-second run deadline.
- Provider failures terminate the run; another attempt starts a new run.
- Missing decisive evidence produces `incomplete`. Provider or unrecoverable validation failure produces `failed`.
- Keep credentials private. Do not print keys or include them in commits, screenshots, traces, or frontend configuration.

### Execution and Records
- Complete the selected package and its necessary checks.
- Continue independent mocked work when a partner dependency is unavailable, but leave the affected live/shared gate pending.
- Commit completed Lane A work to local `lane-a` after checks pass.
- Report: package status, changes made, checks executed and results, commit SHA, partner dependencies/blockers, readiness for next package.
- Stop after the selected package's report. Do not automatically execute the next package.

---

## 5. Interface Boundaries

### From Lane B (consume through agreed interfaces)
| Component | Interface | Status |
|---|---|---|
| Evidence adapters | `EvidenceTools` implementation | Pending |
| Synthetic fixtures | Fixture catalogue with `kind: 'fixture'` | Pending |
| Route calculations | `CalculationProvider.calculateRouteExcess()` | Pending |
| No-show calculations | `CalculationProvider.getNoShowFee()` | Pending |
| Paid-charge caps | `CalculationProvider.getPaidChargeCap()` | Pending |
| Frontend | React app polling `/api/runs/:id` | Pending |
| Evaluation tooling | Golden cases + expected outcomes | Pending |

### To Lane B (supply)
| Component | Deliverable | Status |
|---|---|---|
| Contract examples | `examples/catalog.json` + `examplesFor()` | v0.1.0 ready |
| API routes | `POST /api/runs`, `GET /api/runs/:id` | v0.1.0 ready |
| Event contract | `ActivityEventSchema` types and sequences | v0.1.0 ready |
| Run payload | `RunSchema` with status/events/result | v0.1.0 ready |

---

## 6. Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-08 | Git workflow: CodeBuddy commits locally, user pushes manually | User instruction to manage GitHub pushes |
| 2026-10-08 | Foundation commit from existing workspace (no remote history to preserve) | Zero commits existed; scaffold was already prepared |
| 2026-10-08 | Contract 0.2.0 will split `JudgeResult` into `JudgeModelResponse` + server `JudgeResult` | Plan requires model to select remedyId only; server constructs FinalAction |

---

## 7. Blockers and Pending Gates

| Blocker | Owner | Impact | Mitigation |
|---|---|---|---|
| Partner evidence adapters | Lane B | CB-02 live gate, CB-05 integration | Use mock evidence provider for independent work |
| Partner calculation spec | Lane B | CB-03 monetary validation, CB-04 boundary tests | Define `CalculationProvider` interface; mock impl for tests |
| Partner fixtures | Lane B | CB-05 golden case verification | Continue with contract examples + labeled mocks |
| Live model credentials | Shared | CB-02 connectivity check, all live gates | Use `.env` template; run `check:model` when available |

---

## 8. Acceptance Evidence

| Package | Evidence Required | Location |
|---|---|---|
| CB-00 | Foundation SHA, lane-a branch, execution brief, status record | Git log, docs/LANE_A_*.md |
| CB-01 | Contract 0.2.0 schemas, updated examples, passing tests | packages/contracts/, examples/, tests/ |
| CB-02 | Mock evidence provider, tool-loop tests, prompt drafts | packages/agents/src/ |
| CB-03 | Live mode support, event emitter, deadline enforcement, remedy builder | apps/api/src/, packages/agents/src/ |
| CB-04 | New test files (tool-loop, remedy-validation, failure-coverage), all passing | tests/ |
| CB-05 | Integration branch, pinned SHAs, combined verification results | ryde-integration branch |
| CB-06 | Architecture diagram, setup instructions, measured results, narration | docs/ARCHITECTURE.md, docs/READINESS.md |
| CB-07 | Fresh checkout verification, release PR, archived evidence | main branch (via PR) |
