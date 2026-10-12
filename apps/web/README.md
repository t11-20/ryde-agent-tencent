# @fairtrip/web

FairTrip web UI — a single-page React/Vite prototype that shows Ryde dispute resolution end to end: pick a synthetic fixture, start a run, watch the Rider Advocate, Driver Advocate and Judge activity on a live timeline, and inspect the retrieved evidence, the policy clauses, the ruling and (for completed runs only) the server-calculated action. Failed and incomplete runs never show an action or an amount. Case files can be exported as JSON.

## Running

- Start the API on `http://127.0.0.1:3001` first (from the repo root: `npm run dev`).
- Then from the repo root: `npm run dev:web` — serves the UI on `http://127.0.0.1:5173` and proxies `/api` to the API.
- Checks: `npm run verify:web` (typecheck, unit tests, production build).

## Demo operator script

Run this order when showing the screen to an audience:

1. Start the API: from the repo root `npm run dev` (with `RUN_MODE=stub` in `.env` for a rehearsal without model calls, `RUN_MODE=live` for the real model). Wait for the `listening` line.
2. Start the UI: from the repo root `npm run dev:web`, then open `http://127.0.0.1:5173`.
3. **R1** (route deviation): pick `R1` in the fixture select, point at the editable rider claim and the driver statement, then select **Resolve dispute**. While it runs, point at: both advocates' independent tool requests and retrieved-ID chips in the centre columns; the timeline on the right, where the large **Both cases handed to the Judge** marker appears; the Judge's ruling, findings, model-assessed confidence bar and both explanation blocks; and the action card with **S$1.98 to the rider** and the "calculated by the server" note. Click any chip to jump to its evidence card or policy clause.
4. **N2** (no-show): switch the fixture and resolve again — the action card shows the charge is kept at **S$0.00**.
5. **X1** (missing GPS): resolve and show "No ruling or payment was issued; this case needs human review" with the GPS reason in the Status panel, and no action card.
6. Scroll to the evidence row (GPS / Chat / Payment / History columns), open a `Facts` disclosure, and finish on the policy clauses (DEMONSTRATION POLICY). Use **Export case file** to download the JSON record of the last run.

## Labels

All data is SYNTHETIC. The policy shown is a DEMONSTRATION POLICY, never "Ryde policy". Route comparisons are against a reference route, never an "optimal route".
