---
description: Run one FairTrip Lane B task card, e.g. /lb-task LB-03
argument-hint: "<task id, e.g. LB-03>"
---

Execute FairTrip task $ARGUMENTS.

1. Read `CODEBUDDY.md`, then `harness/tasks/$ARGUMENTS.md`, then only the spec files in `harness/spec/` for the sections that card lists (index: `harness/SPEC.md`).
2. Check `harness/STATUS.md`: every task under "Requires" must be DONE. If one is not, stop and say which.
3. State your plan in 3–8 lines: the files you will create or modify (all must be in the card's "Files" list) and the order of steps. Then continue without waiting.
4. Do the steps in order and run each step's check. Fix only files the card allows. Stop after 3 failed attempts at the same error.
5. Run every command under "Verify", tick the "Acceptance" list, update `harness/STATUS.md`, and commit with the card's commit message.
6. End with the report block defined in `CODEBUDDY.md`.
