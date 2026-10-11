---
description: Report FairTrip repository state and progress without changing files
---

Do not change any files.

1. Run `git status --short`, `git branch --show-current` and `git log --oneline -5`.
2. If `apps/web/package.json` has a `dev` script, run `npm run verify`; otherwise run `npm run typecheck` and `npm test`.
3. Read `harness/STATUS.md`.
4. Report: branch, uncommitted files, verify result (PASS, or the first error line), tasks DONE, any BLOCKED task with its error, and the next TODO task with its "Requires".
