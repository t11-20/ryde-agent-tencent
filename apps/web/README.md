# @fairtrip/web

FairTrip web UI — a single-page React/Vite prototype that shows Ryde dispute resolution end to end. The page reads top to bottom like a hearing:

- **Case bar** — pick a synthetic fixture, edit the rider claim, read the driver statement, and select Resolve dispute.
- **Bench** — the run status band: stage tracker and elapsed timer while the hearing runs; on completion the ruling, the server-calculated action (completed runs only — failed and incomplete runs never show an amount), model-assessed confidence and Export case file. An escalated run shows an amber "Sent to human review" bench instead, with the Judge's recommendation clearly marked as a recommendation.
- **Hearing lines** — a four-lane chart of the run on a seconds axis: the Rider Advocate and Driver Advocate lanes leave the trunk as they gather evidence and rejoin it at the Judge handoff interchange, and a Risk Analyst lane below them joins the handoff too when it ran. Stations are activity events; the full activity log sits under a disclosure.
- **Hearing columns** — Rider Advocate, Judge's findings and Driver Advocate panels: requested remedy, clamped case summaries and arguments with evidence/policy chips, counterevidence and missing facts. The Judge column also lists the precedents considered (for consistency only).
- **Risk analyst** — the context-only risk assessment when one exists: level, source note, summary, per-party signals with evidence chips, and the caveat that risk never establishes fault.
- **Evidence locker** — decisive-fact gauges (route vs reference, pickup arrival and wait, fare breakdown with server-computed eligible amounts) above the retrieved records grouped by GPS, Chat, Payment and History. Chat messages render as plain-text bubbles; instruction-like text is badged as evidence only.
- **Policy applied** — the retrieved demonstration-policy clauses, cited clauses first.

## Human review

When a run completes below the configured confidence threshold or with a high risk assessment, the Judge's ruling and the server-computed amount are escalated as recommendations only. The bench then offers **Confirm ruling** and **Override…** (a replacement remedy plus an optional note) to a human reviewer. After review the bench shows the final ruling — "Confirmed by a human reviewer" or "Overridden by a human reviewer" — and the reviewed run is appended to the precedent store so later runs can match it for consistency.

Case files can be exported as JSON. Clicking any chip scrolls to the matching evidence card or policy clause.

## Replay mode (demo safety net)

Start the API with `RUN_MODE=replay npm run dev` (optionally `REPLAY_SPEED=20` to compress the timeline). The UI then replays the recorded events of a past live release-gate run — the header reads **Replay of live run · recorded \<date\>**. No model is called; the evidence locker, money, precedents and human-review controls still behave exactly as in a live run because they are served by the real API. Every run also gets a shareable deep link (`?run=<id>` — pasted into the address bar it resumes the same run), and a **Recent runs…** select next to the case picker lists this session's runs newest first.

## Running

- Start the API on `http://127.0.0.1:3001` first (from the repo root: `npm run dev`).
- Then from the repo root: `npm run dev:web` — serves the UI on `http://127.0.0.1:5173` and proxies `/api` to the API.
- Checks: `npm run verify:web` (typecheck, unit tests, production build).

## Demo operator script

Run this order when showing the screen to an audience:

1. Start the API: from the repo root `npm run dev` (with `RUN_MODE=stub` in `.env` for a rehearsal without model calls, `RUN_MODE=live` for the real model). Wait for the `listening` line.
2. Start the UI: from the repo root `npm run dev:web`, then open `http://127.0.0.1:5173`.
3. **R1** (route deviation): pick `R1` in the case select, point at the rider claim and the driver statement in the case bar, then select **Resolve dispute**. While it runs, point at: the stage tracker in the bench; the hearing lines, where the rider and driver lanes leave the trunk and rejoin it at the **Both cases handed to the Judge** interchange, with the Risk Analyst lane beneath; and the gathered-records footer in each advocate column. When the ruling lands, the bench turns to the rider tint with **Refund S$1.98 to the rider**, the model-assessed confidence bar and the "calculated by the server" note. Scroll to the route-vs-reference gauge in the evidence locker. Click any chip to jump to its evidence card or policy clause.
4. **N2** (no-show): switch the case and resolve again — the bench turns to the driver tint with **Keep the charge: S$0.00 refunded**, and the pickup meters show which no-show conditions were met.
5. **X1** (missing GPS): resolve and show the amber bench reading **No ruling: decisive evidence is missing** with the reason listed — and no amount anywhere.
6. Open **Show full activity log** under the hearing lines, then finish on the evidence locker groups and **Policy applied** (demonstration policy). Use **Export case file** to download the JSON record of the last run.

## Labels

All data is SYNTHETIC. The policy shown is a DEMONSTRATION POLICY, never "Ryde policy". Route comparisons are against a reference route, never an "optimal route".
