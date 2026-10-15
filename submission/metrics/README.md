# FairTrip measured metrics

- Date of run: 2026-10-13 (release-gate run `20261013-144417`, UTC timestamp in `scorecard.md`)
- Command: `npm run eval -- --fixtures release --release-gate`
- Result: `Release gate: PASS` (27 / 27 runs passed, all seven conditions, exit code 0)
- What ran: the 20 synthetic, team-authored Lane B fixtures in canonical order — R1, N2 and R1F three consecutive attempts each for the consistency condition, the other 17 once — plus one human-review feedback probe. The probe confirmed the escalated X2 run (action unchanged), overrode the escalated N2H run to `refund_no_show_fee` (500 cents, matching the server-computed eligible amount), then ran N2 a fourth time and verified it saw the new `human_override` precedent while still ruling `keep_charge`; the override is a synthetic probe recorded in the API's in-memory store until restart, not a real decision
- Prompts: advocate and Judge prompts include the LB-15 step 4 rule lines (append-only), the Judge context rules (`JUDGE_CONTEXT_RULES`), and the Risk Analyst prompt
- Model: `MiniMax-M3`
- Model base URL host: `api.minimax.io`
- Run mode: live (real model calls through the FairTrip API at `http://127.0.0.1:3001`, contract 0.3.0)
- Running the gate: run exactly one gate at a time against an otherwise idle API started fresh (`npm run dev`). The runner cannot detect a sibling run; two concurrent gates double the model load (observed: p50 16–23 s alone vs 32 s concurrent, max 80 s) and share the in-memory precedent store, so their results are invalid.
- Provider latency varies by hour: per-role model time was p50 7.1 s / max 10.8 s at 14:44 SGT (run 20261013-144417) and p50 10.7 s / max 41.1 s at 01:50 SGT (run 20261014-015019). Run the gate in daytime hours; the scorecard's failure classes and per-role latency show whether a failure was provider-side.
- The API retries a first-attempt workflow failure once automatically (provider- and model-side alike; `VERDICT_INVARIANT`/`REPLAY_INVALID` excepted); the runner follows the re-run (`retriedBy`) and reports the attempt's own latency and the whole-round-trip wall time separately — the scorecard marks re-runs ` (re-run)` and shows `latency (wall)` where they differ.
- Latency A/B: run the gate and compare the `Model calls (s)`, `Directed repairs`, `Normalisations` and `Call-level recoveries` lines against the 20261014-093354 scorecard. `Model settings` in the header records the `MODEL_THINKING`/`MODEL_SERVICE_TIER` the API was running; `output.normalised` events are cosmetic fixes that cost no extra model call, while `model.retry`/`model.hedge` are call-level recoveries that never trigger a workflow re-run.

## Stability record (all release-gate runs, 2026-10-13 to 2026-10-14)

Ten release-gate runs were executed against the live model between 07:36 SGT on 2026-10-13 and 05:56 SGT on 2026-10-14; two of them (`20261014-011142` and `20261014-011147`) were started five seconds apart against one API and are invalid as gate results (shared model budget and precedent store). Across all ten: **206 completed rulings, 1 incorrect** — R3 in the concurrent run `20261014-011142`, ruled `refund_route_excess` at confidence 0.78 against RD-4; **36 `incomplete` runs, all correct** (missing GPS or payment); **16 `failed` runs, none of which issued a ruling or an amount**. Every failed run was a provider timeout, a network error, the 90 s run deadline, or model output that failed schema/citation validation; no failed run was a decision.

The decision record is what the deterministic policy verdict (contract 0.3.2) now guarantees by construction: a finalised remedy must equal the verdict computed from the trip and payment facts, a Judge that disagrees is escalated for human review, and the single incorrect ruling above (0.78) would today be escalated twice over — by the raised 0.80 confidence threshold and by the `policy_divergence` rule. The failure record is what the retry policy addresses: one automatic re-run per first-attempt failure, visible in the trace, proven never to pay twice (`tests/adversarial/lifecycle-attacks.test.ts`). Provider latency remains outside the system's control and varies by hour (see above); the demo therefore runs in replay mode (`RUN_MODE=replay`, a recording of run `20261013-144417`) with live runs used only when a pre-flight run confirms the provider is responsive.

## Files

- `scorecard.md`: readable scorecard (per-run table, metrics, release gate conditions)
- `scorecard.json`: the same results in machine-readable form

## Labels

- All dispute data is **SYNTHETIC DATA**. No real riders, drivers or trips.
- The rules applied are a **DEMONSTRATION POLICY**, not Ryde policy.
- The comparison path in route disputes is a **reference route**.
- Confidence values in the results are **model-assessed confidence**, not accuracy or certainty.
- Risk thresholds are **demonstration heuristics** (`RISK_PARAMS`), not Ryde rules; risk is context only and never establishes fault.
- Token usage was not measured (the API does not report it).
- These numbers were measured once against the live model on the date above. Results from other runs may differ.
