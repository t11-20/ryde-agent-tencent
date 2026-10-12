# @fairtrip/web

FairTrip web UI — a single-page React/Vite prototype that shows Ryde dispute resolution end to end: pick a synthetic fixture, start a run, watch the Rider Advocate, Driver Advocate and Judge activity on a live timeline, and inspect the retrieved evidence, the policy clauses, the ruling and (for completed runs only) the server-calculated action. Failed and incomplete runs never show an action or an amount. Case files can be exported as JSON.

## Running

- Start the API on `http://127.0.0.1:3001` first (from the repo root: `npm run dev`).
- Then from the repo root: `npm run dev:web` — serves the UI on `http://127.0.0.1:5173` and proxies `/api` to the API.
- Checks: `npm run verify:web` (typecheck, unit tests, production build).

## Labels

All data is SYNTHETIC. The policy shown is a DEMONSTRATION POLICY, never "Ryde policy". Route comparisons are against a reference route, never an "optimal route".
