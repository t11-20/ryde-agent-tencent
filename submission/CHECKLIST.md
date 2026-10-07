# Submission checklist

Deadline: **16 Oct 2026**. Status values: TODO, IN PROGRESS, DRAFTED, DONE, BLOCKED.

E1 and E2 are described in handoff section 11.1. The handoff maps E3–E6 to the Lane B submission drafts, but it does not
name each item or describe E7. **Confirm the exact wording of E3–E7 against `Ryde_Two_Lane_Execution_Plan.md`**, and
correct the rows below if they differ.

| Item | Description | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|---|
| E1 | Project built using CodeBuddy or WorkBuddy | Partner + Edward | TODO | — | Must be genuine development done in CodeBuddy or WorkBuddy; work done in other tools does not count |
| E2 | At least 3 genuine CodeBuddy development-chat screenshots | Partner | TODO | `submission/screenshots/README.md` lists what to capture | Needs E1 work |
| E3 | Title and case-study line | Partner | DRAFTED | `submission/identity.md` | Human sign-off |
| E4 | Blurb (9 words or fewer) and cover-image exports (1920×1080, 384×216) | Partner | DRAFTED (text) / TODO (image) | `submission/identity.md` | Cover image not made |
| E5 | Project description | Partner + Edward | DRAFTED | `submission/description.md` | Metrics need a real scorecard; Lane A sections (architecture, prompting) to fill |
| E6 | Screenshots and submission checklist | Partner | DRAFTED | this file; `submission/screenshots/README.md` | Product screenshots need the live system |
| E7 | *Not described in the handoff; fill from the execution plan* | ? | TODO | — | Execution plan wording to be checked |

## Deliverables

| Deliverable | Owner | Status | Evidence | Blocker |
|---|---|---|---|---|
| Public GitHub repo accessible to judges | Partner | TODO | — | Check visibility before submission |
| Evidence package, fixtures, policy, examples | Lane B | DONE | `packages/evidence` | — |
| Web UI | Lane B | DONE (provisional contracts) | `apps/web` | Swap to Lane A contracts at integration |
| Agents, Judge, API, validation | Lane A (Edward) | ? | — | — |
| Architecture diagram and root setup guide | Lane A (Edward) | ? | — | — |
| Evaluation scorecard from real runs | Partner | TODO | `packages/eval` ready | Needs Lane A backend + API key |
| Release gate passed (plan 12.3) | Partner + Edward | TODO | `npm run eval -- --fixtures release --release-gate` | Needs Lane A backend |
| Presentation deck | Partner | TODO | — | — |
| Demo operation and backup recording | Partner | TODO | Operator script in `apps/web/README.md` | Needs the live system |
| Submission form | Partner | TODO | — | — |
| Final review of every claim in `description.md` | Partner | TODO | — | After scorecard |
