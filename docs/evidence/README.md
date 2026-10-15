# Development evidence

Capture real CodeBuddy desktop work at foundation, implementation, and debugging checkpoints (at least three readable development-chat screenshots across the project, as specified in the existing execution plan). Include the project context, prompt, relevant response/tool activity, date, lane, and caption.

Every development-chat capture in this folder is from a genuine CodeBuddy desktop session; see the captions table below. Keep credentials and login QR codes out of captures; private captures can go in the ignored `private/` directory.


## Project access check — 8 October 2026 (Singapore)

`00-project-open.png` is an unedited native capture of the CodeBuddy desktop window titled Tencent. The Explorer shows this project's source folders and configuration files. It establishes that the project is open; it is an access check and is not counted as one of the development-chat captures.

The development-chat captures were taken during the Lane B tasks (LB-00 to LB-15) in CodeBuddy desktop, 11–13 October 2026. Each shows the project, the task prompt, the agent's response or tool activity and, where relevant, the terminal output.

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
