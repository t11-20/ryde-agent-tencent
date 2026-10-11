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
| `Model request failed (HTTP 401)` | Wrong or expired key in `.env`. |
| `HTTP 404` | Wrong `MODEL_NAME` or `MODEL_BASE_URL` (use `https://api.openai.com/v1` for OpenAI). |
| `HTTP 400` | An option in `MODEL_EXTRA_BODY` is not supported by your model; remove it. JSON mode also needs the word "JSON" in the request (handled by LB-11). |
| `HTTP 429` | Rate limit; wait a minute and retry. Runs are sequential on purpose. |
| `Advocate … produced unparseable output` / `output.repair` events | Set `MODEL_EXTRA_BODY='{"response_format":{"type":"json_object"}}'` in `.env` and restart the server. |
| `Each live advocate must independently request evidence and policy` | The model skipped a tool; apply LB-15 step 4. |
| `Run deadline exceeded (90s)` or aborted model calls | The model is too slow for the 20 s per-call limit; choose a faster model or lower reasoning effort. |

## Git

| Symptom | Fix |
|---|---|
| Merge conflict, or changes you did not make | STOP and report; do not resolve conflicts in Lane A files yourself. |
| `rejected … non-fast-forward` on push | `git pull --ff-only origin lane-b-codebuddy`; never force-push. |
