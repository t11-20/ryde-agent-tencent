# FairTrip evaluation scorecard

- Date: 2026-10-13T14:44:17.036Z
- Base URL: http://127.0.0.1:3001
- Output folder: packages/eval/results/20261013-144417
- Data: synthetic fixtures; policy: demonstration policy.

## Runs

| Fixture | Attempt | Status | Remedy | Amount (cents) | Risk | Escalated | Latency | Pass | Failing checks |
|---|---|---|---|---|---|---|---|---|---|
| R1 | 1 | completed | refund_route_excess | 198 | low | no | 16.2 s | PASS | - |
| R1 | 2 | completed | refund_route_excess | 198 | low | no | 19.2 s | PASS | - |
| R1 | 3 | completed | refund_route_excess | 198 | low | no | 18.2 s | PASS | - |
| R1S | 1 | completed | refund_route_excess | 297 | low | no | 17.2 s | PASS | - |
| R2 | 1 | completed | keep_charge | 0 | medium | no | 14.2 s | PASS | - |
| R3 | 1 | completed | keep_charge | 0 | low | no | 15.1 s | PASS | - |
| R4 | 1 | completed | keep_charge | 0 | low | no | 16.1 s | PASS | - |
| R1F | 1 | completed | refund_route_excess | 198 | high | yes | 17.2 s | PASS | - |
| R1F | 2 | completed | refund_route_excess | 198 | high | yes | 18.2 s | PASS | - |
| R1F | 3 | completed | refund_route_excess | 198 | high | yes | 18.2 s | PASS | - |
| X1 | 1 | incomplete | - | - | low | no | 17.2 s | PASS | - |
| X4 | 1 | incomplete | - | - | low | no | 17.2 s | PASS | - |
| N1 | 1 | completed | refund_no_show_fee | 500 | medium | no | 14.1 s | PASS | - |
| N1R | 1 | completed | refund_no_show_fee | 500 | high | yes | 14.1 s | PASS | - |
| N2 | 1 | completed | keep_charge | 0 | low | no | 15.1 s | PASS | - |
| N2 | 2 | completed | keep_charge | 0 | low | no | 17.2 s | PASS | - |
| N2 | 3 | completed | keep_charge | 0 | low | no | 16.1 s | PASS | - |
| N2H | 1 | completed | keep_charge | 0 | high | yes | 16.1 s | PASS | - |
| N3 | 1 | completed | refund_no_show_fee | 500 | low | no | 15.1 s | PASS | - |
| N4 | 1 | completed | refund_no_show_fee | 500 | low | no | 14.2 s | PASS | - |
| N5 | 1 | completed | keep_charge | 0 | medium | no | 15.1 s | PASS | - |
| N6 | 1 | completed | keep_charge | 0 | low | no | 14.1 s | PASS | - |
| X2 | 1 | completed | keep_charge | 0 | high | yes | 16.1 s | PASS | - |
| X3 | 1 | incomplete | - | - | low | no | 15.1 s | PASS | - |
| X5 | 1 | incomplete | - | - | low | no | 15.1 s | PASS | - |
| X6 | 1 | completed | keep_charge | 0 | high | yes | 17.1 s | PASS | - |
| N2 (feedback probe) | 4 | completed | keep_charge | 0 | low | no | 16.1 s | PASS | - |

## Metrics

- Runs passed: 27 / 27
- Fixtures passed: 20 / 20
- Exact money: 27 / 27
- Citation validity: 27 / 27
- Trace completeness: 27 / 27
- Risk signals intact: 27 / 27
- Escalated runs: 7 (outcome unchanged: 7)
- Human-review feedback probe: pass
- Consistency: 3 / 3 repeated fixtures
- p50 latency: 16.1 s
- Max latency: 19.2 s
Token usage: not measured (the API does not report it).

## Escalated runs

- R1F #1 — risk high — refund_route_excess 198
- R1F #2 — risk high — refund_route_excess 198
- R1F #3 — risk high — refund_route_excess 198
- N1R #1 — risk high — refund_no_show_fee 500
- N2H #1 — risk high — keep_charge 0
- X2 #1 — risk high — keep_charge 0
- X6 #1 — risk high — keep_charge 0

## Human-review feedback probe

- Confirm: X2 run 8adbc460-916e-4c73-90a7-7d08e2d711da — confirmed, action unchanged
- Override: N2H run 52b7a28a-fbfa-4644-9b63-5df494e4a1e6 → refund_no_show_fee 500 cents (server-computed eligible: 500 cents)
- Probe run: N2 #4 completed PASS — precedent check: ok
- Problems: none
- The override is a synthetic probe, recorded in the API's in-memory precedent store until restart; it is not a real decision.

## Release gate

Release gate: PASS

- golden-pass-once: PASS (ok)
- consistency-three-consecutive: PASS (ok)
- missing-evidence-incomplete: PASS (ok)
- variation-fairness-injection: PASS (ok)
- deadline-and-contract: PASS (ok)
- risk-context-only: PASS (ok)
- human-review-feedback: PASS (ok)
