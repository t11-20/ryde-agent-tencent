# Copy-paste prompts

Use these when slash commands are not available, or with any other coding agent. Always start a new chat for a new task.

## P1 — Run a task

```
You are working in the FairTrip repository. Execute task LB-XX.
1. Read CODEBUDDY.md, then harness/tasks/LB-XX.md, then only the files in harness/spec/ for the sections that card lists (index: harness/SPEC.md).
2. Check harness/STATUS.md: every task under "Requires" must be DONE; otherwise stop and tell me which is missing.
3. Post a 3–8 line plan naming the files you will create or modify (all must be in the card's "Files" list), then continue.
4. Do the steps in order, running each check. Change only allowed files. Stop after 3 failed attempts at the same error.
5. Run every "Verify" command, tick the "Acceptance" list, update harness/STATUS.md, commit with the card's message.
6. End with the report block from CODEBUDDY.md.
```

## P2 — Fix a failing check

```
In the current FairTrip task, this check fails: <paste the command and the first error lines>.
Re-run it and read the FIRST error. Look it up in harness/TROUBLESHOOTING.md. Explain the root cause in two sentences before editing.
Fix only files the current task card allows; never change tests' expected values or files in packages/evidence/data/.
Re-run the check. After 3 failed attempts, mark the task BLOCKED in harness/STATUS.md with the exact error and report.
```

## P3 — Resume an interrupted task

```
Task LB-XX was interrupted. Run `git status --short` and `git diff --stat`, read harness/tasks/LB-XX.md, and tell me which steps are already done and which remain.
Then continue from the first unfinished step, following CODEBUDDY.md. Do not redo finished steps unless their check fails.
```

## P4 — Self-review before committing

```
Before committing task LB-XX, review your own changes with `git diff`:
- every changed file is in the card's "Files" list;
- every relative import ends in .js; no `any`; no money computed with floating point;
- no test expectation or data file was changed to make a test pass;
- no secrets, no .env content, nothing from origin/lane-b.
Report any problem and fix it; otherwise commit with the card's message.
```

## P5 — Status check

```
Do not change files. Run `git status --short`, `git log --oneline -5`, and `npm run typecheck && npm test`.
Read harness/STATUS.md. Report: uncommitted files, test result, tasks DONE, any BLOCKED task and its error, and the next TODO task.
```

## P6 — Hand a blocked task to a stronger model

```
Summarise task LB-XX for another engineer in under 25 lines: the goal, what you changed (files), the exact failing command and first error, what you tried, and your best hypothesis. Do not change any files.
```

## P7 — Draft submission text (LB-16)

```
Using submission/metrics/scorecard.md, harness/spec/13-labelling-and-honesty-rules.md and the hackathon requirements in harness/reference/submissions.md and harness/reference/requirements.md, draft submission/description.md with the headings listed in harness/tasks/LB-16.md.
Use only numbers that appear in the scorecard; write "not measured" otherwise; describe impact as projected.
```

## P8 — Stop the agent calculating by hand

```
Stop working out numbers yourself. Follow the "Calculations: code only" rules in CODEBUDDY.md:
every value must come from calling the functions in packages/evidence/src (formulas.ts, geo.ts, money.ts, routeMetrics, checkFare, remedyBasis).
To see a value, run `npm run build` and `node harness/audit/show-fixture.mjs <FIXTURE_ID>`.
Expected values in tests come only from harness/spec/07-golden-values.md and harness/spec/05-calculations.md §5.10, copied exactly.
Remove any number you calculated yourself from src/ and tests, then run `node harness/audit/check-golden.mjs` and fix every FAIL.
```

