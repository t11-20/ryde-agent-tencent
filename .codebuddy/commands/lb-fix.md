---
description: Diagnose and fix a failing check in the current FairTrip task
argument-hint: "<failing command or error text>"
---

A check failed in the current FairTrip task: $ARGUMENTS

1. Re-run the failing command and read the FIRST error, not the last.
2. Look for it in `harness/TROUBLESHOOTING.md`.
3. Name the single root cause in two sentences before changing any code.
4. Fix it only in files the current task card allows. Never edit test expectations, golden numbers or data files.
5. Re-run the command. If it still fails after 3 attempts, set the task to BLOCKED in `harness/STATUS.md` with the exact error line and report.
