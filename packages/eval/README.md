# @fairtrip/eval

The evaluation runner and scorecard. It drives Lane A's API with the SYNTHETIC fixtures and checks every run against
`@fairtrip/evidence`'s expected-outcome matrix, evidence index and DEMONSTRATION POLICY.

## Usage

```bash
npm ci
npm run eval -- --base-url http://localhost:3001 --fixtures golden
npm run eval -- --fixtures release --repeat 1 --release-gate     # what the plan 12.3 gate needs
npm run eval -- --fixtures R1,N2 --repeat 3
npm run eval:demo                                                # against the in-process FAKE server
```

| Option | Default | Meaning |
|---|---|---|
| `--base-url` | `http://localhost:3001` | Lane A API |
| `--fixtures` | `golden` | `golden` (R1, R2, R3, N1, N2, N3), `all` (12), `release`, or a list such as `R1,N2` |
| `--repeat` | `1` | runs per fixture |
| `--timeout-sec` | `90` | per-run timeout |
| `--delay-ms` | `2000` | pause between runs (provider rate windows) |
| `--poll-ms` | `1000` | polling interval |
| `--concurrency` | `1` | parallel runs (keep at 1 against the real provider) |
| `--out` | `results` | output root |
| `--release-gate` | off | exit code 2 unless the release gate passes |
| `--label` | none | banner at the top of the scorecard |

The `release` preset runs the six golden fixtures plus X1, X2, X3 and N2H. It runs R1 and N2 `max(repeat, 3)` times. That
is the minimum set the release gate needs. A gate run on `R1,N2` alone fails, because the other gate fixtures show as "not run".

For each run, the runner:
1. Sends `POST /api/runs { fixtureId }`.
2. Polls `GET /api/runs/:id?after=<seq>` until the status is `completed`, `incomplete` or `failed`, or the run times out.
3. Saves the raw run.

Outputs go to `results/<ISO-timestamp>/`:
- `scorecard.json`
- `scorecard.md`
- `runs/<fixture>-<attempt>.json`

`results/` is git-ignored.

## Checks

| Check | Rule |
|---|---|
| `statusMatch` | Expected `resolved` must end `completed` with a result and action. Expected `incomplete` must end `incomplete` with **no** action amount. |
| `remedyMatch` | `result.action.remedyId` equals the expected remedy. Expected `null` means no action. |
| `amountExact` | `amountCents` equals the expected integer cents exactly. Expected `null` means no action. |
| `citationsValid` | Every evidence and policy ID cited in either case or in the Judge's findings exists in `getEvidenceIndex` / the policy. Unknown IDs are listed. |
| `decisiveCoverage` | Share of the expected decisive evidence IDs the Judge cited. **Reported only**; not a pass condition. |
| `traceComplete` | All of the following hold:<br>• each advocate has at least one `tool_requested` and one `tool_result`<br>• across both advocates, retrieved evidence covers every *available* family<br>• both advocates emit `case_submitted`<br>• `handoff_to_judge` comes after both<br>• a terminal event exists |
| `noReasoningLeak` | No `<think>` / `</think>` in the strings of `cases`, `result`, `events[].summary` or `error`, and no `reasoning_content` key anywhere in the run view. |
| `latencyMs` | Time from `POST` to the terminal status. |
| `usage` | `modelCalls` and tokens, when the API provides them. |

A run **passes** when `statusMatch`, `remedyMatch`, `amountExact`, `citationsValid`, `traceComplete` and `noReasoningLeak` all hold.
**Consistency** means repeated runs of a fixture all produce the same `(status, remedyId, amountCents)`.

Event-type and actor names are defined in one place, `src/traceRules.ts`, so they can follow Lane A's final contract.
`src/contracts.ts` is a PROVISIONAL mirror of Lane A's run view.

## Release gate (plan 12.3)

`--release-gate` exits non-zero unless all of these hold:
- All six golden fixtures pass at least once.
- R1 and N2 each pass 3 consecutive runs.
- X1 and X3 end `incomplete` with no amount.
- X2 and N2H end `keep_charge`.
- No run times out or exceeds 90 s.

## Scorecard

`scorecard.md` reports:
- fixture pass count
- exact monetary correctness
- citation validity
- repeated-run consistency
- trace completeness
- reasoning-leak check
- p50 and max latency
- model calls and tokens

Anything the API did not provide is printed as **Not measured**. The scorecard never invents a number.

`npm run eval:demo` exists only to show the pipeline works. Its scorecard is labelled **FAKE SERVER DEMO** and must not be
quoted as a result.
