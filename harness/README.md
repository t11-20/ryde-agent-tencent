# FairTrip Lane B harness — guide for the human

This folder lets a CodeBuddy agent (any model, including small ones) rebuild Lane B one small, verifiable task at a time. You stay in charge of setup, secrets, servers, screenshots, reviews and the submission form.

## Where things stand

| Area | State |
|---|---|
| Lane A on `main` (contracts, three agents, Judge, API, 67 tests) | Done and passing |
| Lane B evidence layer, integration, UI, evaluation | Not started (the old `lane-b` branch is not used) |
| Real model runs | Not yet; your MiniMax Token Plan key (MiniMax-M3) is first tested in LB-11 |
| CodeBuddy screenshots (3 required) | None yet; capture at the 📸 tasks |
| Cover, description, presentation, updated architecture diagram | Not started (LB-16) |

The deadline used in this plan is **16 October 2026**, taken from your earlier handoff. Check it on the hackathon page.

## One-time setup

1. Install Node **22.23.3** and npm **10.9.9** exactly (LB-00 shows the commands). The repository rejects other versions.
2. Create the branch `lane-b-codebuddy` from `origin/main` and unzip this harness into the repository root (LB-00).
3. Open the repository folder in CodeBuddy.
4. Your model key goes only into `.env` (LB-11) and, if CodeBuddy uses it too, your user-level `~/.codebuddy/models.json`. Never put it in the project's `.codebuddy/` folder, which is committed, and never paste it into a chat.

## Running a task

1. Open a **new chat** for every task. Small models lose track in long chats.
2. Type `/lb-task LB-03` (replace the ID). If slash commands do not appear in your CodeBuddy version, paste prompt P1 from `PROMPTS.md`.
3. Read the plan the agent posts. If it lists a file that is not in the card's **Files** list, stop it.
4. When the report arrives, check `RESULT` and the `VERIFY` lines. If it says BLOCKED, open a new chat with `/lb-fix <the error>`; if that fails too, switch to the stronger model for that task.
5. At the end of each day: `git push -u origin lane-b-codebuddy`.

**Choosing between your two coding models:** run LB-02 with one and LB-03 with the other. Keep whichever passes **Verify** with fewer interventions. Use the stronger one for LB-09, LB-13 and LB-14, the three riskiest tasks.

## Checking a task's work yourself

Green tests only prove the agent's own tests pass; a weak model can write tests that check its own wrong numbers. After LB-02 to LB-08, run the independent audit, which calls the agent's functions on the original data and compares the answers with the spec's numbers:

```
npm run build
node harness/audit/check-golden.mjs
```

The audit also changes fixture inputs (a different rate, fee or route) to prove results are computed rather than hardcoded, and scans the source for golden numbers or fixture IDs. To see what the code computes for a fixture, run `node harness/audit/show-fixture.mjs R1`.

`[PASS]` = matches the spec. `[FAIL]` = wrong result, shown as expected vs got; give that line to `/lb-fix` or rerun the task with a stronger model. `[SKIP]` = task not done yet. `[WARN]` = the agent's own tests never mention the spec's numbers (weak tests; a point against that model). A model that reports DONE while the audit shows FAIL for its task should be dropped. From LB-09 on, the evaluation runner (LB-14, LB-15) is the independent check.

## Task map and schedule

| Day | Tasks | Gate at the end of the day |
|---|---|---|
| Sun 11 Oct (evening) | LB-00 setup · LB-01 workspace · LB-02 data | Baseline green; dataset loads |
| Mon 12 Oct | LB-03 helpers · LB-04 GPS · LB-05 chat · LB-06 payment · LB-06A formula functions · LB-07 evidence | All golden numbers reproduced; audit shows no hand calculations |
| Tue 13 Oct | LB-08 source · LB-09 API wiring · LB-10 golden flow · LB-11 real model | R1 runs through the API with your model |
| Wed 14 Oct | LB-12 web foundation · LB-13 UI · LB-14 evaluation | UI shows a live R1 run; release gate passes with the scripted model |
| Thu 15 Oct | LB-15 live acceptance · LB-16 drafts | Release gate passes with the real model; assets drafted |
| Fri 16 Oct | Rehearsal, fresh-clone check, final review, submit | Submission confirmation saved |

LB-12 and LB-13 only need LB-09, so a second person (or a second chat) can start the UI while LB-10/LB-11 run. Do not run two agents on the same files at once, and let only one of them run `npm install` at a time.

## Screenshot plan (eligibility proof)

Capture the whole CodeBuddy window with the chat visible, during real work:

| File | When |
|---|---|
| `docs/evidence/01-baseline-verify.png` | LB-00, the agent running `npm run verify` |
| `docs/evidence/02-gps-golden-tests.png` | LB-04, golden-number tests running or being fixed |
| `docs/evidence/03-api-integration.png` | LB-09, integration tests passing |
| `docs/evidence/04-ui-live-run.png` | LB-13, the UI after a live R1 run |
| `docs/evidence/05-live-eval.png` | LB-15, diagnosing a failure or the passing gate |

Three are required; five gives you margin. A screen recording of one task also works.

## Jobs only you can do

- Install Node/npm; create `.env` with your key; start and stop servers (`npm run dev`, `npm run dev:web`).
- Take screenshots; push the branch; open the pull request into `main`.
- Get Edward's review of the Lane A edits (message below).
- Export the cover PNGs; build the slides; record the optional video; fill in and submit the form; save the confirmation.
- Decide what to do with the old `lane-b` branch (nothing here uses it).

## Message to Edward

> Lane B is being rebuilt in CodeBuddy on `lane-b-codebuddy`. It needs a few small edits in Lane A files, all tested against your 67 tests:
> 1. `packages/agents/src/index.ts`: new `DisputeSource` and `FixtureListing` interfaces (LB-08) and an `extractJsonText` export (LB-11).
> 2. `apps/api/src/app.ts`, `live-roles.ts`, `server.ts`: optional third `createApp` argument used only in live mode; a guard that marks runs incomplete when GPS or payment data is missing (LB-09).
> 3. `tool-loop.ts`, `live-roles.ts`, `config.ts`, `model.ts`, `scripts/check-model.ts`, `.env.example`: JSON extraction before parsing, optional `MODEL_EXTRA_BODY`, JSON-mode-safe connectivity check (LB-11).
> 4. Possibly append-only prompt rules in `prompts.ts` if the live model misjudges golden cases (LB-15).
> 5. A new section in `docs/ARCHITECTURE.md` and `README.md` (LB-16).
> Could you review the PR and say whether you want to present the architecture part of the demo?

## If you fall behind

Cut in this order: LB-10 (LB-14 covers it) → timeline styling and chip highlighting → the optional video → the optional live link. Never cut: three agents, two categories, the observable trace, citation and money validation, three screenshots, the cover and the description.

## Files

| File | Purpose |
|---|---|
| `../CODEBUDDY.md` | Rules CodeBuddy loads in every chat |
| `../.codebuddy/rules/`, `../.codebuddy/commands/` | Always-on guardrails and the `/lb-task`, `/lb-fix`, `/lb-check` commands |
| `SPEC.md`, `spec/` | Specification index and the 13 section files, including golden numbers |
| `reference/` | Your original challenge and submission requirement documents |
| `tasks/LB-00.md` … `LB-16.md` | One card per task (plus `LB-06A`) |
| `audit/show-fixture.mjs` | Prints what the code computes for one fixture |
| `STATUS.md` | Progress tracker the agent updates |
| `PROMPTS.md` | Copy-paste prompts if slash commands are unavailable |
| `TROUBLESHOOTING.md` | Common errors and fixes |
| `audit/check-golden.mjs` | Independent check of the evidence layer against the spec's numbers |
| `data/` | The synthetic dataset (copied into the package in LB-02) |
