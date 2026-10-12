# FairTrip evaluation scorecard

- Date: 2026-10-12T15:54:33.433Z
- Base URL: http://127.0.0.1:3001
- Output folder: C:\Users\Choo\Desktop\Projects\work\ryde-agent-tencent\packages\eval\results\20261012-155433
- Data: synthetic fixtures; policy: demonstration policy.

## Runs

| Fixture | Attempt | Status | Remedy | Amount (cents) | Latency | Pass | Failing checks |
|---|---|---|---|---|---|---|---|
| R1 | 1 | completed | refund_route_excess | 198 | 20.5 s | PASS | - |
| R1 | 2 | completed | refund_route_excess | 198 | 24.3 s | PASS | - |
| R1 | 3 | completed | refund_route_excess | 198 | 17.2 s | PASS | - |
| R1S | 1 | completed | refund_route_excess | 297 | 20.2 s | PASS | - |
| R2 | 1 | completed | keep_charge | 0 | 19.3 s | PASS | - |
| R3 | 1 | completed | keep_charge | 0 | 20.2 s | PASS | - |
| X1 | 1 | incomplete | - | - | 10.1 s | PASS | - |
| N1 | 1 | completed | refund_no_show_fee | 500 | 21.2 s | PASS | - |
| N2 | 1 | completed | keep_charge | 0 | 15.2 s | PASS | - |
| N2 | 2 | completed | keep_charge | 0 | 12.1 s | PASS | - |
| N2 | 3 | completed | keep_charge | 0 | 16.2 s | PASS | - |
| N2H | 1 | completed | keep_charge | 0 | 24.3 s | PASS | - |
| N3 | 1 | completed | refund_no_show_fee | 500 | 11.1 s | PASS | - |
| X2 | 1 | completed | keep_charge | 0 | 16.2 s | PASS | - |
| X3 | 1 | incomplete | - | - | 16.2 s | PASS | - |

## Metrics

- Runs passed: 15 / 15
- Fixtures passed: 11 / 11
- Exact money: 15 / 15
- Citation validity: 15 / 15
- Trace completeness: 15 / 15
- Consistency: 2 / 2 repeated fixtures
- p50 latency: 17.2 s
- Max latency: 24.3 s
Token usage: not measured (the API does not report it).

## Release gate

Release gate: PASS

- golden-pass-once: PASS (ok)
- r1-n2-three-consecutive: PASS (ok)
- missing-evidence-incomplete: PASS (ok)
- variation-fairness-injection: PASS (ok)
- deadline-and-contract: PASS (ok)
