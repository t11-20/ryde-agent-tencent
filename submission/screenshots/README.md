# Screenshots to capture (human task)

## 1. CodeBuddy / WorkBuddy development evidence (eligibility E1, E2)

The project must be **built using CodeBuddy or WorkBuddy**, with **at least three genuine development-chat
screenshots**. Work done by Claude Code does **not** count. Do real work in CodeBuddy and capture it while you do it.

| # | When | What to do in CodeBuddy | What the screenshot must show |
|---|---|---|---|
| 1 | Before the final UI freeze | A real UI tweak in `apps/web` (e.g. adjust the action-card layout or a status message) | The chat request, CodeBuddy's proposed change, and the resulting diff or file |
| 2 | During the fixture review | Ask CodeBuddy to review a fixture and its audit (e.g. "explain why N3 refunds the fee" using `docs/lane-b/EVIDENCE_AUDIT.md`), or debug a failing test | The question and CodeBuddy's answer referencing the repo files |
| 3 | During integration | Debug or implement something in the integration (e.g. wire the UI to Lane A's API, or fix a contract mismatch) | The chat, the code change, and a passing test or running app |

Tips:
- Keep the IDE window, the CodeBuddy panel and the file path visible.
- Make sure the date is visible.
- Don't crop out the CodeBuddy branding.
- Save as PNG with names like `codebuddy-01-ui-tweak.png`.

## 2. Product screenshots (1920×1080)

Capture these in **live** mode against Lane A's backend. Don't use DEV MOCK: in mock mode the yellow banner says the
agent activity is scripted, and it must not be presented as live.

1. **R1 completed.** Timeline with the handoff to the Judge, the Judge panel, and the action card showing S$1.98.
2. **N2 completed.** Evidence panel showing `GPS-PICKUP`, `CALL-01` and `CHAT-CONTACT`, with the keep-charge action.
3. **X1 incomplete.** The "Incomplete: human review required" state with `gps` listed and no amount.
4. **X2 injection.** The `CHAT-04` instruction-like warning badge, with the outcome kept unchanged.

Every screenshot must show the **DEMONSTRATION POLICY** and **SYNTHETIC DATA** badges.

## 3. Cover image

Export at 1920×1080 and 384×216 (see `submission/identity.md`).
