# FairTrip measured metrics

- Date of run: 2026-10-12 (release-gate run `20261012-153045`, UTC timestamp in `scorecard.md`)
- Command: `npm run eval -- --fixtures release --release-gate`
- Result: `Release gate: PASS` (15 / 15 runs passed)
- Model: `MiniMax-M3`
- Model base URL host: `api.minimax.io`
- Run mode: live (real model calls through the FairTrip API at `http://127.0.0.1:3001`)

## Files

- `scorecard.md`: readable scorecard (per-run table, metrics, release gate conditions)
- `scorecard.json`: the same results in machine-readable form

## Labels

- All dispute data is **SYNTHETIC DATA**. No real riders, drivers or trips.
- The rules applied are a **DEMONSTRATION POLICY**, not Ryde policy.
- The comparison path in route disputes is a **reference route**.
- Confidence values in the results are **model-assessed confidence**, not accuracy or certainty.
- Token usage was not measured (the API does not report it).
- These numbers were measured once against the live model on the date above. Results from other runs may differ.
