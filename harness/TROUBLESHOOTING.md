# Troubleshooting

Find the first error line, then the matching row. Fix only files your current card allows.

## Environment and installs

| Symptom | Cause | Fix |
|---|---|---|
| `Node must be 22.23.3` or `npm ERR! code EBADENGINE` | wrong Node or npm version | Human installs Node 22.23.3 and npm 10.9.9 (LB-00). Never edit `engines`, `.nvmrc` or `.npmrc`. |
| `npm ci` says the lockfile is out of sync | a `package.json` changed without `npm install` | Run `npm install` at the root, then commit `package-lock.json`. |
| `Cannot find module '@fairtrip/evidence'` (or contracts, agents) | the package is not built, or not linked | Run `npm run build`; if it persists, run `npm install` at the root. |
| `EADDRINUSE 127.0.0.1:3001` | another API is already running | Stop the other terminal's server, or set `API_PORT` in `.env` and the Vite proxy target to match. |
| Vite proxy `ECONNREFUSED` | API not running, or wrong address | Start `npm run dev`; the proxy targets `http://127.0.0.1:3001`. |
| PowerShell: `RUN_MODE=live npm run dev` does nothing | inline variables are bash syntax | Put settings in `.env`; it is read automatically. |
| `npm error command failed` after `npm run eval` | the evaluation found failing runs (exit code 1) | Normal; read the scorecard. |

## TypeScript

| Symptom | Fix |
|---|---|
| `TS2835: Relative import paths need explicit file extensions` | End the relative import in `.js`: `./route.js` (even for `.ts`/`.tsx` files). |
| `TS2532` / `TS18048: Object is possibly 'undefined'` | `noUncheckedIndexedAccess`: store `arr[i]` in a constant and check `=== undefined` before use. |
| `TS2375` / `TS2379` mentioning `exactOptionalPropertyTypes` | Do not assign `undefined` to an optional property; omit the key. |
| `Type 'undefined' is not assignable to type 'JSONType'` | Build evidence facts with `asFacts(...)` (SPEC §6.2) and use `null` for missing values. |
| `Property 'passthrough' does not exist` | Zod v4: use `z.looseObject({...})`. |
| `TS2307: Cannot find module 'node:fs'` in `apps/web` | Browser code cannot use Node modules; read data through the API instead. |

## Tests and data

| Symptom | Fix |
|---|---|
| `No test files found` | File names must end in `.test.ts` and live in `tests/` or `packages/*/test/` (web: `apps/web/src/**`). |
| A golden number is slightly off (for example 7957 instead of 7956) | Sum unrounded segment lengths and round once (SPEC §5.1); compare timestamps as numbers with `toEpochSeconds`. |
| Fixture parse error | Do not edit data or loosen schemas. Re-copy `harness/data` (LB-02 step 1) and compare with `git diff --no-index`. |
| `EvidenceSchema` parse fails | Check `timestamp` is never null, `provenance.kind` is `'fixture'`, and facts contain no `undefined`. |
| `Unknown evidence citation` in a run | A case or finding cites an ID that was not retrieved. With the scripted model this is a code bug; with a real model see LB-15 step 4. |

## Live model

| Symptom | Fix |
|---|---|
| `Model request failed (HTTP 401)` | Wrong or expired key, or key and endpoint from different MiniMax regions. A Token Plan key (`sk-cp-…`) from platform.minimax.io works with `https://api.minimax.io/v1`; a China-platform key needs the China endpoint. |
| `HTTP 404` | `MODEL_NAME` must be exactly `MiniMax-M3` (case-sensitive); `MODEL_BASE_URL` must be `https://api.minimax.io/v1`. |
| `HTTP 400` | If every run fails right after both advocates start, while `npm run check:model` passes, MiniMax is rejecting a request without a user message (error 2013): do task LB-11A. Otherwise an option in `MODEL_EXTRA_BODY` is not accepted; go back to `'{"reasoning_split":true}'`. After LB-11A the error text from MiniMax is shown after the status code. |
| `HTTP 429` | The Token Plan quota window is used up. The plan is shared by both of you, so coordinate: avoid evaluation runs while someone is coding with it, then retry later. |
| `Advocate … produced unparseable output` / `output.repair` events | Make sure `.env` has `MODEL_EXTRA_BODY='{"reasoning_split":true}'` and restart the server. |
| `Advocate … produced unparseable output after 1 repair attempts` on every run, after tools were retrieved (LB-11B) | Not a transport problem: MiniMax-M3 returns clean JSON, but writes `counterevidence` items as plain strings while `AdvocateCaseSchema` requires `{claim, evidenceIds, policyClauseIds}` objects; the generic repair prompt does not say what was wrong, so the repair repeats it. Fixed by `COUNTEREVIDENCE_RULE` appended to both advocate prompts in `packages/agents/src/prompts.ts`. If it returns, run `npm run build`, restart the API, and check the advocate prompt still ends with that rule. To see which schema field fails, log the Zod issue paths of the rejected reply (never the key). |
| `Each live advocate must independently request evidence and policy` | The model skipped a tool; apply LB-15 step 4. |
| `Run deadline exceeded (90s)` or aborted model calls | MiniMax-M3 thinks too long for the 20 s per-call limit; use `MODEL_EXTRA_BODY='{"reasoning_split":true,"thinking":{"type":"disabled"}}'` and restart. |

## Git

| Symptom | Fix |
|---|---|
| Merge conflict, or changes you did not make | STOP and report; do not resolve conflicts in Lane A files yourself. |
| `rejected … non-fast-forward` on push | `git pull --ff-only origin lane-b-codebuddy`; never force-push. |
