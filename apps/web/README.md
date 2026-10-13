# @fairtrip/web

FairTrip web UI — a single-page React/Vite prototype that shows Ryde dispute resolution end to end. The page reads top to bottom like a hearing:

- **Case bar** — pick a synthetic fixture, edit the rider claim, read the driver statement, and select Resolve dispute.
- **Bench** — the run status band: stage tracker and elapsed timer while the hearing runs; on completion the ruling, the server-calculated action (completed runs only — failed and incomplete runs never show an amount), model-assessed confidence and Export case file.
- **Hearing lines** — a metro-map of the run: the Rider Advocate and Driver Advocate lanes leave the trunk as they gather evidence and rejoin it at the Judge handoff interchange; stations are activity events on a seconds axis. The full activity log sits under a disclosure.
- **Hearing columns** — Rider Advocate, Judge's findings and Driver Advocate panels: requested remedy, clamped case summaries and arguments with evidence/policy chips, counterevidence and missing facts.
- **Evidence locker** — decisive-fact gauges (route vs reference, pickup arrival and wait, fare breakdown with server-computed eligible amounts) above the retrieved records grouped by GPS, Chat, Payment and History. Chat messages render as plain-text bubbles; instruction-like text is badged as evidence only.
- **Policy applied** — the retrieved demonstration-policy clauses, cited clauses first.

Case files can be exported as JSON. Clicking any chip scrolls to the matching evidence card or policy clause.

## Running

- Start the API on `http://127.0.0.1:3001` first (from the repo root: `npm run dev`).
- Then from the repo root: `npm run dev:web` — serves the UI on `http://127.0.0.1:5173` and proxies `/api` to the API.
- Checks: `npm run verify:web` (typecheck, unit tests, production build).

## Demo operator script

Run this order when showing the screen to an audience:

1. Start the API: from the repo root `npm run dev` (with `RUN_MODE=stub` in `.env` for a rehearsal without model calls, `RUN_MODE=live` for the real model). Wait for the `listening` line.
2. Start the UI: from the repo root `npm run dev:web`, then open `http://127.0.0.1:5173`.
3. **R1** (route deviation): pick `R1` in the case select, point at the rider claim and the driver statement in the case bar, then select **Resolve dispute**. While it runs, point at: the stage tracker in the bench; the hearing lines, where the rider and driver lanes leave the trunk and rejoin it at the **Both cases handed to the Judge** interchange; and the gathered-records footer in each advocate column. When the ruling lands, the bench turns to the rider tint with **Refund S$1.98 to the rider**, the model-assessed confidence bar and the "calculated by the server" note. Scroll to the route-vs-reference gauge in the evidence locker. Click any chip to jump to its evidence card or policy clause.
4. **N2** (no-show): switch the case and resolve again — the bench turns to the driver tint with **Keep the charge: S$0.00 refunded**, and the pickup meters show which no-show conditions were met.
5. **X1** (missing GPS): resolve and show the amber bench reading **No ruling: decisive evidence is missing** with the reason listed — and no amount anywhere.
6. Open **Show full activity log** under the hearing lines, then finish on the evidence locker groups and **Policy applied** (demonstration policy). Use **Export case file** to download the JSON record of the last run.

## Labels

All data is SYNTHETIC. The policy shown is a DEMONSTRATION POLICY, never "Ryde policy". Route comparisons are against a reference route, never an "optimal route".
