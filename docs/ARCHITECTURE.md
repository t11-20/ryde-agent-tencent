# FairTrip Architecture and Technical Documentation

**Project:** FairTrip — Ryde Multi-Agent Dispute Resolution Prototype  
**Version:** 0.2.0  
**Date:** 2026-10-08  
**Lane A Commit:** `0ebd544`

---

## 1. Architecture

### 1.1 System Overview

FairTrip resolves ride-hailing disputes through three distinct LLM agents:

1. **Rider Advocate** — Gathers evidence and builds the rider's case
2. **Driver Advocate** — Gathers evidence and builds the driver's defense
3. **Judge** — Reviews both cases, applies policy, and selects a remedy

The server constructs the final monetary action from the Judge's remedy selection using validated partner calculations.

### 1.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client (Browser)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Fixture   │  │   Run       │  │   Poll      │  │   Export        │ │
│  │   Selector  │  │   Creator   │  │   Status    │  │   Trace         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────────┘ │
└─────────┼────────────────┼────────────────┼─────────────────────────────┘
          │ POST /api/runs │                │ GET /api/runs/:id
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Server (Express)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Health    │  │   Fixtures  │  │   Run       │  │   Run Query     │ │
│  │   /health   │  │   /fixtures │  │   Creator   │  │   /runs/:id     │ │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  └─────────────────┘ │
│                                           │                              │
│                              ┌────────────┴────────────┐                 │
│                              │    In-Memory Store      │                 │
│                              │    (Map<string, Run>)   │                 │
│                              └─────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Orchestration                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  runWorkflow(dispute, roles, evidence, policies, signal, emitter)│   │
│  │                                                                  │   │
│  │  ┌─────────────┐              ┌─────────────┐                   │   │
│  │  │ Rider       │  Parallel    │ Driver      │                   │   │
│  │  │ Advocate    │◄────────────►│ Advocate    │                   │   │
│  │  │ (tool loop) │              │ (tool loop) │                   │   │
│  │  └──────┬──────┘              └──────┬──────┘                   │   │
│  │         │                            │                          │   │
│  │         ▼                            ▼                          │   │
│  │  ┌─────────────────────────────────────────┐                    │   │
│  │  │         EvidenceTools (mock/partner)     │                    │   │
│  │  │  get_evidence({sources})                 │                    │   │
│  │  │  get_policy({category})                  │                    │   │
│  │  └─────────────────────────────────────────┘                    │   │
│  │         │                            │                          │   │
│  │         ▼                            ▼                          │   │
│  │  ┌─────────────┐              ┌─────────────┐                   │   │
│  │  │ Rider Case  │              │ Driver Case │                   │   │
│  │  │ (validated) │              │ (validated) │                   │   │
│  │  └──────┬──────┘              └──────┬──────┘                   │   │
│  │         │                            │                          │   │
│  │         └────────────┬───────────────┘                          │   │
│  │                      ▼                                          │   │
│  │               ┌─────────────┐                                   │   │
│  │               │    Judge    │                                   │   │
│  │               │  (model)    │                                   │   │
│  │               └──────┬──────┘                                   │   │
│  │                      │                                          │   │
│  │                      ▼                                          │   │
│  │         ┌─────────────────────────┐                            │   │
│  │         │  Remedy Builder         │                            │   │
│  │         │  (server-constructed)   │                            │   │
│  │         └─────────────────────────┘                            │   │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Flow

1. **Filing:** Client POSTs `fixtureId` + optional `riderClaim` → server creates Run (queued)
2. **Advocacy:** Both advocates start in parallel, each with its own tool loop
   - Max 2 tool-request rounds per advocate
   - Max 1 repair attempt per advocate
   - 20-second timeout per model request
3. **Validation:** Each advocate case is schema-validated and citation-checked against its retrieval scope
4. **Judge Handoff:** Only after both cases pass validation does the Judge start
5. **Adjudication:** Judge receives both cases + retrieved evidence + policy + permitted remedies
6. **Action Construction:** Server builds `FinalAction` from Judge's `remedyId` using `CalculationProvider`
7. **Result:** Run transitions to `completed`, `incomplete`, or `failed`

### 1.4 Event Flow

```
run.started
├── rider: model.start
├── rider: model.finish
├── rider: tool.requested (optional)
├── rider: evidence.retrieved / policy.retrieved (optional)
├── rider: output.repair (optional)
├── rider: case.completed
├── driver: model.start
├── driver: model.finish
├── driver: tool.requested (optional)
├── driver: evidence.retrieved / policy.retrieved (optional)
├── driver: output.repair (optional)
├── driver: case.completed
├── judge: judge.started
├── judge: model.start
├── judge: model.finish
└── system: run.completed / run.incomplete / run.failed
```

---

## 2. Startup and Verification

### 2.1 Prerequisites

- Node.js 22.23.3 (see `.node-version`)
- npm 10.9.9
- No credentials required for stub mode

### 2.2 Installation

```bash
cd /Users/edward/Documents/ChatGPT/Tencent
npm ci
```

### 2.3 Verification

```bash
npm run verify
```

This runs: `typecheck` → `test` → `build` → `check:examples` → `check:setup`

Expected output: all 48 tests pass, 0 build errors, examples validate.

### 2.4 Start the API (Stub Mode)

```bash
npm run dev
```

Server starts on `127.0.0.1:3001`. Health endpoint: `GET /api/health`

### 2.5 Start the API (Live Mode)

```bash
cp .env.example .env
# Edit .env: RUN_MODE=live, MODEL_API_KEY=..., MODEL_BASE_URL=..., MODEL_NAME=...
npm run dev
```

### 2.6 Run Tests Only

```bash
npm test              # all tests
npx vitest run tests/tool-loop.test.ts   # specific file
```

---

## 3. Prompt Design

### 3.1 Advocate Prompts

Each advocate receives:
- Dispute context (ID, category, claims)
- Role definition (represent rider or driver)
- Tool protocol instructions (JSON format for tool requests)
- Citation rules (only cite retrieved evidence/policy)
- Final case format (strict JSON schema)

**Key design decisions:**
- Advocates are NOT preloaded with evidence — they must request it via tools
- Tool requests are validated JSON, not free-form text
- Each advocate has independent retrieval scope; citations are checked against it

### 3.2 Judge Prompt

The Judge receives:
- Both validated advocate cases
- The retrieved evidence and policy records (the "source union")
- Permitted remedy IDs (not amounts)
- Instructions to select only a remedy ID, not monetary values

**Key design decisions:**
- Judge never generates money — the server constructs `FinalAction`
- This prevents model hallucination of amounts and ensures deterministic validation
- Missing decisive evidence must produce `incomplete` ruling

---

## 4. Tool-Use Protocol

### 4.1 Advocate Response Format

Discriminated union:

```typescript
// Request tools
{type: "tool_request", tools: [
  {name: "get_evidence", input: {sources: ["gps", "chat"]}},
  {name: "get_policy", input: {category: "route_deviation"}}
]}

// Final case
{type: "final_case", case: AdvocateCase}
```

### 4.2 Execution Limits

| Limit | Value | Enforcement |
|---|---|---|
| Tool rounds per advocate | 2 | Loop counter in `runAdvocateToolLoop` |
| Repair attempts per advocate | 1 | Counter in catch block |
| Model request timeout | 20s | `AbortSignal.timeout(20000)` |
| Run deadline | 90s | `AbortController` with `setTimeout(90000)` |

### 4.3 Mock Evidence Provider

When partner adapters are unavailable, `createMockEvidenceTools(dispute)` returns labeled synthetic data:

| Family | Route Deviation | No-Show |
|---|---|---|
| GPS | Actual vs reference route, distances | Pickup proximity, waiting time |
| Chat | Messages between rider/driver | Contact attempts |
| Payment | Itemized fare breakdown | Cancellation fee |
| History | Dispute counts, ratings | Dispute counts, ratings |

All provenance is marked `kind: 'contract_example'` with description noting mock origin.

---

## 5. Validation and Failure Handling

### 5.1 Citation Validation

`validateCitations(cases, result, evidence, policies)` checks:
- All `evidenceIds` in arguments/counterevidence/findings exist in the provided evidence set
- All `policyClauseIds` exist in the provided policy set
- No duplicate source identifiers

### 5.2 Remedy Validation

`buildFinalAction(modelResponse, evidence, calculationProvider)` checks:
- Remedy ID is appropriate for dispute category
- Amount is integer, non-negative, finite SGD cents
- Refund does not exceed paid charge cap
- `keep_charge` has zero amount and no recipient

### 5.3 Failure Modes

| Scenario | Behavior | Event |
|---|---|---|
| Invalid advocate JSON | 1 repair attempt, then fail | `output.repair` → `run.failed` |
| Wrong advocate side | Fail immediately | `run.failed` |
| Invented citation | Fail during validation | `run.failed` |
| One advocate fails | Sibling cancelled, Judge not called | `run.failed` |
| Model timeout | Abort signal triggers | `run.failed` |
| Run deadline exceeded | Abort controller triggers | `run.failed` |
| Missing decisive evidence | `incomplete` ruling, no invented amount | `run.incomplete` |
| Wrong-category remedy | Server returns `keep_charge` + error | `run.incomplete` |
| Excessive refund | Capped at paid charge | `run.incomplete` |

---

## 6. Measured Prototype Results

### 6.1 Test Coverage

| Test File | Tests | Coverage |
|---|---|---|
| `contracts.test.ts` | 12 | Schema validation, citation checks, event types |
| `workflow.test.ts` | 6 | Parallel advocates, Judge ordering, cancellation, event emission |
| `api.test.ts` | 4 | End-to-end stub flow, concurrent isolation, input validation |
| `config-model.test.ts` | 4 | Config parsing, model adapter, error sanitization |
| `tool-loop.test.ts` | 8 | Tool protocol, repair, rounds, deduplication |
| `remedy-validation.test.ts` | 7 | Remedy construction, category validation, caps |
| `failure-coverage.test.ts` | 7 | One advocate, sibling cancellation, citations, fairness |
| **Total** | **48** | |

### 6.2 Build and Verification

| Check | Status |
|---|---|
| TypeScript typecheck | Pass (strict mode) |
| Test suite | 48/48 pass |
| Build (contracts → agents → api) | Pass |
| Example validation | Pass |
| Setup verification | Pass |

### 6.3 Limitations

- **Live model:** Not yet tested with real model credentials
- **Partner calculations:** Using mock `CalculationProvider`; real GPS/fare calculations pending
- **Partner fixtures:** Using synthetic contract examples; golden cases pending
- **Frontend:** Partner-owned; no UI integration tested
- **Evaluation:** No partner evaluation runner or scorecard
- **Persistence:** In-memory only; no database
- **Authentication:** Not implemented
- **Hosting:** Local development only

---

## 7. Demonstration Narration

### 7.1 R1 — Route Deviation with Unjustified Detour

**Setup:** Rider claims driver took a longer route without justification.

**Flow:**
1. Rider Advocate requests GPS and payment evidence
2. Driver Advocate requests GPS and policy
3. Both cases are validated and cite actual retrieved records
4. Judge receives: GPS shows 3200m actual vs 2800m reference (14% excess), no rider consent in chat, no documented diversion
5. Judge selects `refund_route_excess`
6. Server calculates: eligible excess = 200 cents, capped at total paid (770 cents) → refund 200 cents
7. Result: `rider_favored`, partial refund of 200 SGD cents

### 7.2 Incomplete — Missing Decisive Evidence

**Setup:** Dispute filed but GPS records are unavailable.

**Flow:**
1. Rider Advocate requests GPS evidence → empty result
2. Driver Advocate requests GPS evidence → empty result
3. Both cases note missing GPS in `missingFacts`
4. Judge receives cases with no GPS evidence
5. Judge rules `incomplete` — cannot determine if detour occurred
6. Server produces no monetary action
7. Result: `incomplete`, missing evidence identified

---

## 8. Development Evidence

Genuine CodeBuddy development screenshots to capture:

1. **CB-01 implementation** — Contract revision with `JudgeModelResponse` split
2. **CB-02 implementation** — Tool loop execution with mock model responses
3. **CB-04 verification** — Test suite showing 48 passing tests

Current screenshot archive: `docs/evidence/00-project-open.png`

---

## 9. Repository Structure

```
fairtrip/
├── apps/
│   ├── api/              # Express API (Lane A)
│   │   ├── src/
│   │   │   ├── app.ts    # Routes, run controller, terminal guards
│   │   │   ├── catalog.ts # Fixture loader
│   │   │   ├── config.ts  # Environment validation
│   │   │   ├── model.ts   # OpenAI-compatible adapter
│   │   │   └── server.ts  # Entry point
│   │   └── package.json
│   └── web/              # React frontend (Lane B)
├── packages/
│   ├── contracts/        # Zod schemas (shared)
│   │   └── src/index.ts  # All schemas, types, validation
│   └── agents/           # Agent framework (Lane A)
│       └── src/
│           ├── index.ts       # runWorkflow, interfaces
│           ├── prompts.ts     # Role prompts
│           ├── tool-loop.ts   # Advocate tool execution
│           ├── mock-evidence.ts # Mock evidence provider
│           └── remedy-builder.ts # FinalAction construction
├── tests/
│   ├── contracts.test.ts
│   ├── workflow.test.ts
│   ├── api.test.ts
│   ├── config-model.test.ts
│   ├── tool-loop.test.ts
│   ├── remedy-validation.test.ts
│   └── failure-coverage.test.ts
├── examples/
│   ├── catalog.json      # Contract examples
│   ├── run.json          # Complete run example
│   └── final-action.json # Action example
├── docs/
│   ├── CONTRACTS.md      # Contract documentation
│   ├── ARCHITECTURE.md   # This file
│   ├── LANE_A_EXECUTION.md
│   └── LANE_A_STATUS.md
└── scripts/
    ├── check-examples.ts
    ├── check-model.ts
    └── check-setup.ts
```

---

## 10. Branch Structure

| Branch | Purpose | Current SHA |
|---|---|---|
| `main` | Release history | `ea37153` |
| `lane-a` | Lane A development | `8c4073a` |
| `lane-b` | Partner development | Pending |
| `ryde-integration` | Combined testing | `0ebd544` (Lane A pin) |

---

*This document reflects the implemented system as of Lane A commit `0ebd544`. All claims are based on passing tests and verified behavior, not projected performance.*
