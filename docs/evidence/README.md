# Development evidence

Capture real CodeBuddy desktop work at foundation, implementation, and debugging checkpoints (at least three readable development-chat screenshots across the project, as specified in the existing execution plan). Include the project context, prompt, relevant response/tool activity, date, lane, and caption.

No screenshot here is claimed until a genuine Buddy session occurs. Do not substitute this Codex chat for Buddy evidence. Keep credentials and login QR codes out of captures; private captures can go in the ignored `private/` directory.


## Project access check — 8 October 2026 (Singapore)

`00-project-open.png` is an unedited native capture of the CodeBuddy desktop window titled Tencent. The Explorer shows this project's source folders and configuration files. It establishes that the project is open; it does not establish successful signed-in agent access or count as one of the three development-chat captures.

## Tasks for genuine development captures

Submit these in CodeBuddy against the Tencent project. Save actual responses/tool results, with the project name and prompt visible. These are reviews of the existing foundation; do not claim CodeBuddy originally authored it.

1. **Foundation review:** Read README.md, package.json, scripts/check-setup.ts and docs/READINESS.md. Verify the local setup prerequisites; exclude partner verification/contract review and live API credentials. Report additional unfinished prerequisites with file references. Do not modify files, read populated .env files, or call a live runtime API.
2. **Implementation review:** Read packages/contracts/src, packages/agents/src, apps/api/src and their tests. Trace one stub run from creation to polling. Check schema validation, citation validation, independent advocates and Judge ordering, and explicit stub labels. Report findings with file references. Do not modify files or read secrets.
3. **Verification:** Run npm run verify. Report actual results and explain which failure cases the existing tests cover. Diagnose any failures without changing files. Do not call a live runtime API, install dependencies, or claim production readiness.

Capture names: `01-foundation-review.png`, `02-implementation-review.png`, `03-verification.png`. Add captures if necessary for readable output. Record Lane A, date, prompt and observed results in captions after capture. Keep these tasks pending until the actual images have been saved and reviewed.

## Captions table (Lane B, LB-16)

| File | What it shows | Task ID | Date |
|---|---|---|---|
| `00-project-open.png` | CodeBuddy desktop window with the Tencent project open (access check; not a development chat) | CB-00 setup | 2026-10-08 |
| `01-baseline-verify.png` | Genuine CodeBuddy development chat: LB-00 setup and baseline card, report block and passing `npm run verify` output in the terminal | LB-00 | 2026-10-11 |
| `02-gps-golden-tests.png` | Genuine CodeBuddy development chat: LB-04 GPS metrics card, `route.ts` source and golden-value test output in the terminal | LB-04 | 2026-10-11 |
| `03-api-integration.png` | Genuine CodeBuddy development chat: LB-09 report, live API serving Lane B fixtures, `harness/STATUS.md` beside it | LB-09 | 2026-10-12 |
| `04-ui-live-run.png` | Genuine CodeBuddy development chat: LB-13 report beside the running web UI at `127.0.0.1:5173` after a live R1 run | LB-13 | 2026-10-12 |
| `05-live-eval.png` | Genuine CodeBuddy development chat: LB-15 with the release-gate eval run (15/15 PASS, `Release gate: PASS`) in the terminal | LB-15 | 2026-10-13 |
| `05-lb15-completed.png` | Genuine CodeBuddy development chat: LB-15 DONE report, gate PASS 6/6 first try, scorecard saved to `submission/metrics/` | LB-15 | 2026-10-13 |
| `05-ui-screenshot.png` | Browser capture of the web UI after a live R1 run: ruling, arguments, chips and agent activity (product screenshot, not a development chat) | LB-13 / LB-15 rehearsal | 2026-10-13 |
| `06-lb11-debugging.png` | Genuine CodeBuddy development chat: LB-11 debugging of the MiniMax request shape with probe output and fix options table | LB-11 | 2026-10-12 |

Genuine CodeBuddy development chats in this folder: 7 (`01`, `02`, `03`, `04`, `05-live-eval`, `05-lb15-completed`, `06`) — above the required minimum of 3. `00-project-open.png` is an access check and `05-ui-screenshot.png` is a product capture; neither is counted as a development chat.
