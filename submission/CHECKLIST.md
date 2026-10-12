# FairTrip — submission checklist

One row per requirement from `harness/reference/submissions.md` sections 8–10 and the Ryde deliverables. Status values: `Ready`, `Ready — human finalises`, `Pending human`, `Optional — not pursued`.

## §8 Other requirements as per the challenge statement

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Ryde challenge-specific requirements (three agents, text + structured evidence, two categories, observable communication, prototype, architecture diagram, demo walkthrough, GitHub repo) | Both | Ready | Rows in §9 D–I below | none |

## §9 Complete submission checklist

### A. Eligibility / basic project requirements

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Project is original | Both | Ready | Repository history (`git log`) | none |
| Built using CodeBuddy | Both | Ready | `docs/evidence/` (7 genuine development chats), `docs/evidence/README.md` captions | none |
| Proof of CodeBuddy usage included | Lane B | Ready | `docs/evidence/README.md` captions table | none |
| Proof includes ≥3 development-chat screenshots | Lane B | Ready | `docs/evidence/01-baseline-verify.png`, `02-gps-golden-tests.png`, `03-api-integration.png`, `04-ui-live-run.png`, `05-live-eval.png`, `05-lb15-completed.png`, `06-lb11-debugging.png` | none |

### B. Project identity

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Project title prepared | Lane B | Ready — human finalises | `submission/identity.md` ("FairTrip") | none |
| Short blurb prepared | Lane B | Ready — human finalises | `submission/identity.md` | none |
| Blurb under 10 words | Lane B | Ready | `submission/identity.md` (8 words) | none |
| Ryde case study clearly identified | Lane B | Ready | `submission/identity.md`, `submission/description.md` | none |
| Case study stated at the beginning of the presentation | Lane B | Ready | `submission/presentation-outline.md` slide 1, `submission/demo-script.md` 0:00–0:35 | none |

### C. Project description

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Target scenarios explained | Lane B | Ready | `submission/description.md` §Project overview | none |
| Target users explained | Lane B | Ready | `submission/description.md` §Project overview | none |
| Value proposition explained | Lane B | Ready | `submission/description.md` §Project overview | none |
| Pain points identified and sourced | Lane B | Ready | `submission/description.md` §Real-world scenario insights (challenge statement, attributed) | none |
| Target audience identified | Lane B | Ready | `submission/description.md` §Real-world scenario insights | none |
| Core problems solved explained | Lane B | Ready | `submission/description.md` §Real-world scenario insights | none |
| Business architecture explained | Lane B | Ready | `submission/description.md` §Comprehensive solution design | none |
| Technical architecture explained | Lane B | Ready | `submission/description.md` §Comprehensive solution design; `docs/ARCHITECTURE.md` §11 | none |
| AI / agent architecture explained | Lane B | Ready | `submission/description.md`; `docs/ARCHITECTURE.md` §1, §11 | none |
| Prompting approach / how prompts drive AI generation explained | Lane B | Ready | `submission/description.md` §Comprehensive solution design; `docs/ARCHITECTURE.md` §3 | none |
| Business impact explained | Lane B | Ready | `submission/description.md` §Business value (projected, labelled) | none |
| Quantifiable metrics included | Lane B | Ready | `submission/description.md` §Business value, copied from `submission/metrics/scorecard.md` | none |
| Expected impact clearly defined as projected | Lane B | Ready | `submission/description.md` §Business value | none |

### D. Ryde core multi-agent requirements

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Rider Advocate Agent (gathers evidence, builds case, cites policy, argues rider-favorable) | Lane A | Ready | `packages/agents/src/` (`prompts.ts`, `tool-loop.ts`), `tests/workflow.test.ts` | none |
| Driver Advocate Agent (gathers evidence, builds case, cites policy, argues driver-favorable) | Lane A | Ready | `packages/agents/src/`, `tests/workflow.test.ts` | none |
| Judge Agent (receives both cases, weighs evidence, applies policy, ruling + confidence + reasoning + recommended action) | Lane A | Ready | `packages/agents/src/`, `apps/api/src/` (`buildFinalAction`), `tests/remedy-validation.test.ts` | none |

### E. Evidence sources

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| GPS & telemetry data | Lane B | Ready | `packages/evidence/src/route.ts`, `pickup.ts`; fixtures in `packages/evidence/data/` | none |
| Chat & communication logs | Lane B | Ready | `packages/evidence/src/chat.ts` | none |
| Payment & fare data | Lane B | Ready | `packages/evidence/src/fare.ts`, `money.ts` | none |
| Historical behavior profiles | Lane B | Ready | History records in `packages/evidence/data/` fixtures | none |

### F. Dispute categories

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Route Deviation end-to-end | Both | Ready | Fixtures R1, R1S, R2, R3, X1; golden flow tests `tests/integration/` | none |
| No-Show Charge end-to-end | Both | Ready | Fixtures N1, N2, N2H, N3, X2, X3; golden flow tests | none |

### G. Required end-to-end flow

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| File → both advocates gather evidence → build cited cases → Judge weighs, applies policy, rules with confidence and reasoning → system action → explanations to both parties | Both | Ready | `tests/integration/` golden-flow tests; UI (`apps/web`); scorecard trace completeness 15/15 | none |

### H. Agent observability

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Inter-agent communication observable (activity timeline, retrieved records per advocate, Judge evaluation, ruling) | Lane B | Ready | `apps/web/src/components/Timeline.tsx`, `AdvocatePanel.tsx`, `JudgePanel.tsx`; `docs/evidence/04-ui-live-run.png` | none |

### I. Required Ryde deliverables

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Working prototype (end-to-end, two categories) | Both | Ready | `npm run dev` + `npm run dev:web`; scorecard 11/11 fixtures | none |
| Architecture diagram (multi-agent + key components) | Lane A + Lane B | Ready | `docs/ARCHITECTURE.md` §11 (Mermaid, SPEC §1) and §1.2 | none |
| Demo walkthrough (live demonstration) | Both | Ready — human finalises | `submission/demo-script.md`; rehearsal traces | none |
| Complete source code through GitHub | Lane A | Ready | https://github.com/t11-20/ryde-agent-tencent | none |

### J. Required hackathon submission assets

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Project title | Lane B | Ready — human finalises | `submission/identity.md` | none |
| Short blurb under 10 words | Lane B | Ready — human finalises | `submission/identity.md` | none |
| Project description | Lane B | Ready — human finalises | `submission/description.md` | none |
| ≥3 CodeBuddy development screenshots | Both | Ready | `docs/evidence/` (7 genuine chats) | none |
| 16:9 cover image | Lane B | Ready — human finalises | `submission/cover.svg` (1920×1080 master) | Human exports PNGs |
| Recommended size 380×216 (and 384×216) | Human | Pending human | Export from `submission/cover.svg` via Figma/Canva/PowerPoint | Human export |

### K. Optional submission assets

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Demo video (5–8 min, overview, agents, usage, build reflection, Buddy reference) | Human | Optional — not pursued | `submission/demo-script.md` can double as the video script | Human decision |
| Project link (live URL) | Human | Optional — not pursued | Local demo only (`127.0.0.1:5173`) | No hosting in scope |

### L. Optional Ryde stretch goals

| Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Evidence Collection / Fraud / Policy-Precedent agents, image analysis, escalation, learning loop, SLA routing | — | Optional — not pursued | Out of MVP scope per challenge guardrails | none |

## §10 Definition of done

| # | Requirement | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|---|
| 1 | Three mandatory Ryde agents work | Both | Ready | 280 root tests pass (`npm run verify`) | none |
| 2 | Two dispute categories work end-to-end | Both | Ready | Scorecard: R* and N* fixtures passed | none |
| 3 | Agents autonomously gather and analyse evidence | Both | Ready | Tool-loop tests; trace completeness 15/15 | none |
| 4 | Advocates independently construct cases | Lane A | Ready | `tests/workflow.test.ts`; citation scope validation | none |
| 5 | Policy incorporated into cases and ruling | Both | Ready | Citation validity 15/15; policy clauses in `packages/evidence/data/` | none |
| 6 | Judge produces ruling, confidence, reasoning, recommended action | Lane A | Ready | `apps/api/src/` remedy builder; UI Judge panel | none |
| 7 | Inter-agent communication observable | Lane B | Ready | `apps/web` timeline and panels | none |
| 8 | Prototype demonstrable live | Both | Ready — human finalises | `submission/demo-script.md`; LB-15 rehearsal | none |
| 9 | Architecture diagram prepared | Lane A + Lane B | Ready | `docs/ARCHITECTURE.md` §11 | none |
| 10 | Complete source code on GitHub | Lane A | Ready | Repository remote | none |
| 11 | Built using CodeBuddy | Both | Ready | `docs/evidence/` | none |
| 12 | Proof of CodeBuddy usage captured | Both | Ready | `docs/evidence/README.md` | none |
| 13 | ≥3 development chat screenshots available | Both | Ready | 7 genuine chats in `docs/evidence/` | none |
| 14 | Project title finalised | Human | Ready — human finalises | `submission/identity.md` | none |
| 15 | Blurb under 10 words | Lane B | Ready | 8 words | none |
| 16 | Description covers scenarios, users, value, pain points, design, prompting, business value | Lane B | Ready | `submission/description.md` | none |
| 17 | 16:9 cover image prepared | Lane B | Ready — human finalises | `submission/cover.svg` | Human PNG export |
| 18 | All required submission materials ready | Both | Ready — human finalises | `submission/` folder | Human submits |

## Hygiene (LB-16 step 10)

| Check | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| `git ls-files \| grep -E "(^\|/)\.env$"` prints nothing | Agent | Ready | Run at LB-16 | none |
| `git grep -n -E "sk-[A-Za-z0-9]{10,}"` prints nothing | Agent | Ready | Run at LB-16 | none |
| `npm run verify` passes | Agent | Ready | Run at LB-16 | none |
| Fresh clone passes `npm ci && npm run verify` | Human | Pending human | To be run by human on the branch | Human check |
