# FairTrip evaluation scorecard

- Date: 2026-10-12T15:30:45.180Z
- Base URL: http://127.0.0.1:3001
- Output folder: c:\Users\Choo\Desktop\Projects\work\ryde-agent-tencent\packages\eval\results\20261012-153045
- Data: synthetic fixtures; policy: demonstration policy.

## Runs

| Fixture | Attempt | Status | Remedy | Amount (cents) | Latency | Pass | Failing checks |
|---|---|---|---|---|---|---|---|
| R1 | 1 | completed | refund_route_excess | 198 | 23.4 s | PASS | - |
| R1 | 2 | completed | refund_route_excess | 198 | 16.2 s | PASS | - |
| R1 | 3 | completed | refund_route_excess | 198 | 26.2 s | PASS | - |
| R1S | 1 | completed | refund_route_excess | 297 | 36.4 s | PASS | - |
| R2 | 1 | completed | keep_charge | 0 | 17.1 s | PASS | - |
| R3 | 1 | completed | keep_charge | 0 | 28.2 s | PASS | - |
| X1 | 1 | incomplete | - | - | 18.1 s | PASS | - |
| N1 | 1 | completed | refund_no_show_fee | 500 | 13.1 s | PASS | - |
| N2 | 1 | completed | keep_charge | 0 | 22.3 s | PASS | - |
| N2 | 2 | completed | keep_charge | 0 | 22.2 s | PASS | - |
| N2 | 3 | completed | keep_charge | 0 | 21.2 s | PASS | - |
| N2H | 1 | completed | keep_charge | 0 | 39.4 s | PASS | - |
| N3 | 1 | completed | refund_no_show_fee | 500 | 20.2 s | PASS | - |
| X2 | 1 | completed | keep_charge | 0 | 18.2 s | PASS | - |
| X3 | 1 | incomplete | - | - | 14.2 s | PASS | - |

## Metrics

- Runs passed: 15 / 15
- Fixtures passed: 11 / 11
- Exact money: 15 / 15
- Citation validity: 15 / 15
- Trace completeness: 15 / 15
- Consistency: 2 / 2 repeated fixtures
- p50 latency: 21.2 s
- Max latency: 39.4 s
Token usage: not measured (the API does not report it).

## Release gate

Release gate: PASS

- golden-pass-once: PASS (ok)
- r1-n2-three-consecutive: PASS (ok)
- missing-evidence-incomplete: PASS (ok)
- variation-fairness-injection: PASS (ok)
- deadline-and-contract: PASS (ok)
