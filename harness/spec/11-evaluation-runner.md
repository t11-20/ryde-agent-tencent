# SPEC §11. Evaluation runner (`packages/eval`)

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

### 11.1 Usage

```
npm run eval -- --fixtures golden|release|all|R1,N2 [--repeat 1] [--base-url http://127.0.0.1:3001] [--timeout-sec 100] [--poll-ms 1000] [--release-gate]
```

- `golden` = R1, R2, R3, N1, N2, N3. `all` = the 11 fixtures. `release` = all 11, with R1 and N2 run 3 times each (3 consecutive attempts) and the others once. A comma list runs those IDs. `--repeat` multiplies every fixture in the set.
- Runs are sequential. Each: `POST /api/runs {fixtureId}`, then poll `GET /api/runs/:id?after=<max sequence seen>` every `poll-ms` until the status is `completed`, `incomplete` or `failed`, or until `timeout-sec` passes. Merge events by `sequence`; keep the latest full body for everything else. Parse each body with `RunSchema.safeParse`; a parse failure records `contract_mismatch`.
- Output folder: `packages/eval/results/<YYYYMMDD-HHMMSS>/` (no colons, so it works on Windows) containing `runs/<fixtureId>-<attempt>.json`, `scorecard.json` and `scorecard.md`. `results/` is git-ignored.
- Exit code 0 when every run passed (or, with `--release-gate`, when the gate passed); otherwise 1.
- Programmatic API from `src/index.ts`: `runEval(options): Promise<EvalReport>` and `evaluateRun(run, expected, facts): RunChecks`, used by tests.

### 11.2 Checks per run

| Check | Pass rule |
|---|---|
| `statusMatch` | expected `completed` → run `completed` with a `result`; expected `incomplete` → run `incomplete` and no `result` |
| `remedyMatch` | completed: `result.action.remedyId === expectedRemedyId`; incomplete: passes when there is no result |
| `amountExact` | completed: `result.action.amountCents === expectedAmountCents`; incomplete: passes when there is no result |
| `citationsValid` | every `evidenceIds` entry in both cases (arguments and counterevidence) and the Judge findings is in the fixture's full record ID list (§6.4); every `policyClauseIds` entry is a clause of the fixture's category |
| `traceComplete` | for each of `rider` and `driver`: ≥ 1 `tool.requested`, ≥ 1 `evidence.retrieved`, ≥ 1 `policy.retrieved`, exactly one `case.completed`; a `judge.started` event after both `case.completed` events; the IDs in all `evidence.retrieved` events cover every family that has records for the fixture; the last event is `run.completed`, `run.incomplete` or `run.failed` |
| `noReasoningLeak` | no string anywhere in `cases`, `result`, `error` or event summaries contains `<think>` or `</think>`, and no object key named `reasoning_content` appears anywhere |
| `withinDeadline` | latency from POST to the terminal poll ≤ 90 000 ms and not timed out |

A run **passes** when every check passes. Record `latencyMs`, observed status, remedy and amount for each run. `decisiveCoverage` (share of the expected `decisiveEvidenceIds` cited in the Judge findings) is reported but never gates.

### 11.3 Release gate (`--release-gate`)

Passes only when all of these hold:
1. each golden fixture (R1, R2, R3, N1, N2, N3) passed at least once;
2. R1 and N2 each passed 3 consecutive attempts;
3. X1 and X3 ended `incomplete` with no result;
4. R1S, N2H and X2 passed;
5. no run timed out or exceeded 90 s, and no run had `contract_mismatch`.
The scorecard lists each condition as PASS or FAIL with the reason.

### 11.4 Scorecard contents

`scorecard.md` contains: date and base URL; a per-run table (fixture, attempt, status, remedy, amount, latency, pass, failing checks); metrics — fixtures passed / fixtures run, exact money (runs with `amountExact`) / runs, citation validity, trace completeness, consistency (fixtures whose repeated attempts all gave the same status, remedy and amount), p50 and max latency in seconds; the release gate block when requested; and the line `Token usage: not measured (the API does not report it).` Never invent a number.
