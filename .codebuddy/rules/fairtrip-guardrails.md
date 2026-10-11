---
description: FairTrip Lane B guardrails, always applied
alwaysApply: true
---

# FairTrip guardrails

- Follow `CODEBUDDY.md` and the active task card in `harness/tasks/`. One task per chat.
- Edit only files the task card lists under **Files**. Never edit test expectations, golden numbers or anything in `packages/evidence/data/`.
- Every relative import ends in `.js`. Zod v4. No `any`. Money in integer cents using `divHalfUp`.
- Never open `.env`, print keys, use `origin/lane-b`, force-push, or install packages the card does not name.
- After 3 failed attempts at the same error: mark the task `BLOCKED` in `harness/STATUS.md` and report.
