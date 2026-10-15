# SPEC §11. Evaluation runner (`packages/eval`)

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

### 11.1 Usage

```
npm run eval -- --fixtures golden|release|all|R1,N2 [--repeat 1] [--base-url http://127.0.0.1:3001] [--timeout-sec 200] [--poll-ms 1000] [--release-gate]
```

- `golden` = R1, R2, R3, R4, N1, N2, N3, N4. `all` = the 20 fixtures. `release` = all 20, with R1, N2 and R1F run 3 times each (3 consecutive attempts) and the others once — 26 planned runs, plus one feedback-probe run when `--release-gate` is set (§11.3). A comma list runs those IDs. `--repeat` multiplies every fixture in the set.
- Runs are sequential. Each: `POST /api/runs {fixtureId}`, then poll `GET /api/runs/:id?after=<max sequence seen>` every `poll-ms` until the status is `completed`, `incomplete` or `failed`, or until `timeout-sec` passes. Merge events by `sequence`; keep the latest full body for everything else. Parse each body with `RunSchema.safeParse`; a parse failure records `contract_mismatch`. The default `--timeout-sec` is 200 so the window covers one automatic re-run: when the polled run is `failed` with `retriedBy` (the API retries a first-attempt workflow failure once, except `VERDICT_INVARIANT`/`REPLAY_INVALID`), the runner switches to polling `retriedBy` inside the same overall timeout. The stored `RawRun` then records `retriedFrom` (the first attempt's id) and `firstAttempt` (its full run record); `latencyMs` is the re-run's own span — first to last event timestamp — while `wallMs` is the elapsed wall time since the POST. `withinDeadline` and the gate's deadline condition use `latencyMs`.
- Output folder: `packages/eval/results/<YYYYMMDD-HHMMSS>/` (no colons, so it works on Windows) containing `runs/<fixtureId>-<attempt>.json`, `scorecard.json` and `scorecard.md`. `results/` is git-ignored.
- Exit code 0 when every run passed (or, with `--release-gate`, when the gate passed); otherwise 1.
- Running the gate: run exactly one gate at a time against an otherwise idle API started fresh (`npm run dev`). The runner cannot detect a sibling run; two concurrent gates double the model load (observed: p50 16–23 s alone vs 32 s concurrent, max 80 s) and share the in-memory precedent store, so their results are invalid.
- Provider latency varies by hour: per-role model time was p50 7.1 s / max 10.8 s at 14:44 SGT (run 20261013-144417) and p50 10.7 s / max 41.1 s at 01:50 SGT (run 20261014-015019). Run the gate in daytime hours; the scorecard's failure classes and per-role latency show whether a failure was provider-side.
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
| `riskSignalsIntact` | the run's risk assessment equals the deterministic assessment for the same fixture (overall, the full signal list, and the caveat) |
| `contextOnly` | a high overall assessment implies an escalation with `high_risk`; no run escalates for `high_risk` without one; an escalated run must still produce the expected remedy and amount |
| `verdictMatch` | a `failed` run always passes (no ruling to check); otherwise the run must carry a `verdict` whose `outcome` equals the offline `policyVerdict` for the fixture; `incomplete` requires outcome `incomplete`; a completed run must either end on the verdict outcome or, when escalated with `policy_divergence`, carry a `divergence` record whose `verdictOutcome` equals the verdict |

A run **passes** when every check passes. Record `latencyMs`, observed status, remedy and amount for each run. `decisiveCoverage` (share of the expected `decisiveEvidenceIds` cited in the Judge findings) is reported but never gates. The feedback-probe run below also gets `feedbackPrecedent`, a check recorded on the run result but not part of `RunChecks`, so it cannot change `passed`.

Each `RunResult` also carries two diagnostics computed only from the stored run record — no extra calls:

- `failureClass` (`null` when the run passed): `classifyFailure` applies, in order — `provider_timeout` (failed run whose error message contains `aborted due to timeout` or `TimeoutError`), `provider_network` (`fetch failed` or `network`), `run_deadline` (`Run deadline exceeded`), `model_output` (a failed run whose message mentions `unparseable output`, `Unknown evidence citation`, `Unknown policy citation`, `exceeded maximum tool rounds`, `failed schema or citation validation`, `wrong side` or `must independently request` — and any other failed run, which keeps its message in `problem`), `outcome_mismatch` (a `completed`/`incomplete` run where `statusMatch`, `remedyMatch` or `amountExact` fails), and `check_failure` (any remaining trace/citation/risk/deadline failure).
- `roleLatencySec`: for each of `rider`, `driver`, `risk`, `judge`, the seconds from that actor's first `model.start` event to its last `model.finish` event; an actor with either event missing is omitted. For the advocates this spans the whole tool loop (model calls plus tool turns), not a single HTTP call.

`RunResult` also carries `escalationReasons` (the completed run's escalation reasons, empty when not escalated), `divergent` (the reasons include `policy_divergence`), `undetermined` (the run's verdict outcome is `undetermined`), `retried` (this result came from the API's automatic re-run) and `wallMs` (wall time since the POST, including the re-run).

### 11.3 Release gate (`--release-gate`)

Passes only when all of these conditions hold:

1. `golden-pass-once`: each golden fixture (R1, R2, R3, R4, N1, N2, N3, N4) passed at least once;
2. `consistency-three-consecutive`: R1, N2 and R1F each passed 3 consecutive attempts;
3. `missing-evidence-incomplete`: X1, X4, X3 and X5 ended `incomplete` with no result;
4. `variation-fairness-injection`: R1S, N2H, X2, R1F, N1R, N5, N6 and X6 passed;
5. `deadline-and-contract`: no run timed out or exceeded 90 s, and no run had `contract_mismatch`;
6. `risk-context-only`: every completed run kept the deterministic risk assessment intact, escalated exactly when the assessment was high, and never changed its remedy or amount when escalated;
7. `policy-verdict-authoritative`: every run's `verdictMatch` check is ok, and no completed run is divergent without being escalated;
8. `human-review-feedback`: the feedback probe (below) ran cleanly — no recorded problems, the probe run passed, and its `feedbackPrecedent` check is ok. Reports `not run` when the probe was skipped.

The scorecard lists each condition as PASS or FAIL with the reason.

#### Feedback probe

After the planned runs, when `--release-gate` is set:

1. **Confirm** X2 #1 (`POST /api/runs/:id/review` `{decision: 'confirmed'}`): the review must return the run with `decision === 'confirmed'` and an `action` identical to the Judge's.
2. **Override** N2H #1 with `{decision: 'overridden', remedyId: 'refund_no_show_fee'}`: the returned `review.action.amountCents` must equal the server-computed `refund_no_show_fee` eligible amount read from N2H's PAY-REMEDY record (`fixtureFacts.eligibleCents`).
3. Run **N2 once more** (attempt = max so far + 1, file `runs/N2-<attempt>-feedback.json`, marked `probe: 'feedback'`). Its `precedents` must contain the `human_override` entry whose `runId` is the overridden N2H run — the override is posted last so recency ordering surfaces it.

The confirm and override steps require the respective runs to be completed and escalated; a missing or unescalated run records a problem and its step is skipped, as is the probe run when the override failed. The probe's findings are stored on the report as `feedback` (confirm/override run ids, override amount vs eligible amount, `problems`).

### 11.4 Scorecard contents

`scorecard.md` contains: date and base URL; a per-run table (fixture, attempt, status, remedy, amount, risk, escalated, latency, pass, failure class, failing checks — the probe run's fixture cell reads `N2 (feedback probe)`, a re-run's cell is marked ` (re-run)`, and the latency column shows `<attempt> (wall <total>)` when wall time differs from the attempt's own latency); metrics — fixtures passed / fixtures run, exact money (runs with `amountExact`) / runs, citation validity, trace completeness, risk signals intact, escalated runs with an "outcome unchanged" count, the feedback-probe status, consistency (fixtures whose repeated attempts all gave the same status, remedy and amount), p50 and max latency in seconds, `failureClasses` (a count per class, printed only for non-zero classes or `none`), `roleLatency` (per-role p50 and max model time in seconds, rendered as `Model time per role (whole loop, s)` — advocate values cover the whole tool loop), `verdictAgree` (completed unescalated runs whose remedy equals the deterministic verdict, rendered as `Policy verdict: <n> / <finalised> finalised rulings equal the deterministic verdict; divergences escalated: <n>; undetermined: <n>`) and `providerRetries` (`Automatic re-runs after a failed first attempt: <n>`), the latency A/B instrument — `Model calls (s)` (tool-request / case / judge p50 · p90 · max and risk p50 · max, measured from `model.start`/`tool.requested`/`model.finish` spans across every run record including `firstAttempt`), `Directed repairs (extra model calls)`, `Normalisations (no extra call)` and `Call-level recoveries` (`model.retry`/`model.hedge` event counts) — plus a `Model settings: provider=… · thinking=… · service tier=…` header line read from `/api/health`, and the notes that provider-side classes indicate model-endpoint latency or connectivity — not a system decision error — and that a finalised payment can never differ from the deterministic policy verdict since disagreements are escalated (`policy-verdict-authoritative`); an `## Escalated runs` section listing each escalated run (`fixture #attempt — risk <overall> — <remedy> <amount> — <reasons>`); a `## Human-review feedback probe` section (confirm run id and result, override run id, override amount vs the server-computed eligible amount, the probe-run precedent check, recorded problems, and the note that the override is a synthetic probe in the API's in-memory store, not a real decision); the release gate block when requested; and the line `Token usage: not measured (the API does not report it).` Never invent a number.

Extended 2026-10-13 for the twenty-fixture dataset: golden grew to eight fixtures, the consistency triples now include R1F, the missing-evidence and variation sets cover the new robustness fixtures, and the release gate gained the human-review feedback probe. Extended 2026-10-14 (contract 0.3.2): the runner follows the API's single automatic re-run after a provider failure, `verdictMatch` checks every terminal run against the offline deterministic verdict, and the gate gained `policy-verdict-authoritative`.
