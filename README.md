# ryde-agent-tencent — FairTrip

FairTrip — the Ryde dispute-resolution prototype. Lane A provides the three-agent workflow (Rider Advocate, Driver Advocate, Judge) and the Express API; Lane B adds the evidence layer (`@fairtrip/evidence`), the web UI (`apps/web`) and the evaluation runner (`packages/eval`). Stub mode runs offline with Lane A's labeled contract examples. Live mode runs the three agents against Lane B's synthetic fixtures and demonstration policy, with deterministic server-side money and an observable UI.

The collaboration repository's `main` branch combines the original repository history, the verified Lane A snapshot and the integrated Lane B work. `origin/lane-b` is abandoned work and must not be used.

## Requirements

- **Node 22.23.3 and npm 10.9.9, exactly.** The versions are pinned in `package.json` (`engines`), `.nvmrc` and `.node-version`, and `.npmrc` sets `engine-strict=true`. This is deliberate: it keeps every machine on the same locked dependency tree. With any other Node or npm version `npm ci` stops immediately with `npm error notsup`, and `npm run verify` reports the mismatch in its final `check:setup` step.
- To get the exact versions, use a version manager and the pinned files, for example:

```sh
nvm install 22.23.3 && nvm use        # reads .nvmrc; or: fnm use / n 22.23.3
npm install -g npm@10.9.9
node -v && npm -v                      # must print v22.23.3 and 10.9.9
```

- Node 22 remains supported until April 2027: [official release schedule](https://github.com/nodejs/Release).
- Stub and replay modes need no model key. Live mode needs an OpenAI-compatible endpoint configured in `.env` (see "Model configuration").

## Run locally

With the versions above installed:

```sh
cd <Project-Folder>
npm ci
npm run verify
RUN_MODE=stub npm run dev
```

The API listens at `http://127.0.0.1:3001`. No `.env` is required for stub mode. The explicit `RUN_MODE=stub` command also keeps an existing live `.env` from making model requests. Copy `.env.example` to `.env` when configuration is needed. Do not commit populated environment files.

```sh
curl http://127.0.0.1:3001/api/fixtures
curl -X POST http://127.0.0.1:3001/api/runs -H 'Content-Type: application/json' -d '{"fixtureId":"dispute-route-example"}'
```

Use the returned ID with `GET /api/runs/ID?after=0`. Runs are stored in memory and disappear on restart. Live mode also exposes `GET /api/precedents` (the session precedent store) and `POST /api/runs/:id/review` (confirm or override an escalated ruling); see `docs/CONTRACTS.md`. The stub accepts edited claims but returns fixed, labeled development output; it does not evaluate their merits or execute payments. Final `ruling: incomplete` is intentional: a completed stub response is not a completed real adjudication.

## Run the full demo

Use Node **22.23.3** and npm **10.9.9** (see "Requirements").

```sh
npm ci
npm run verify
cp .env.example .env   # add your own MODEL_API_KEY / MODEL_BASE_URL / MODEL_NAME; never commit .env
npm run dev            # terminal 1: API at http://127.0.0.1:3001 (RUN_MODE=live in .env)
npm run dev:web        # terminal 2: web UI at http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173`, pick a fixture (for example R1), click **Resolve dispute** and watch the advocates gather evidence, the Judge rule, and the server compute the amount. Then run **N2H**: it escalates for human review (high risk against the driver) — confirm or override the ruling on the bench. All dispute data is SYNTHETIC DATA and the rules applied are a DEMONSTRATION POLICY.

With the API running, evaluate the live system against the expected outcomes:

```sh
npm run eval -- --fixtures release --release-gate
```

## CodeBuddy desktop development

Use CodeBuddy desktop's **Open Folder** command to open <Project-Folder>. Run the local commands above in its integrated terminal.

CodeBuddy 4.12.1 installation, running state, and the open Tencent project were verified on 8 October 2026. The [project-open screenshot](docs/evidence/00-project-open.png) records folder access. Seven genuine CodeBuddy development-chat captures (tasks LB-00 to LB-15, 11–13 October 2026) with captions are in [docs/evidence](docs/evidence/README.md); the hackathon requires at least three.

The desktop workflow does not require CNB or a separate CodeBuddy CLI installation. Existing `.cnb.yml` and `.ide/Dockerfile` files are optional cloud configuration and have not been built or launched. [Alternative CLI Web UI documentation](https://www.codebuddy.ai/docs/cli/web-ui).

## Contents and ownership

| Location | Purpose |
|---|---|
| `apps/api` | Lane A Express API, live role callbacks, and model adapter |
| `apps/web` | React/Vite single-screen UI (Lane B) |
| `packages/evidence` | Lane B evidence layer: calculations, evidence builder, synthetic fixtures and demonstration policy |
| `packages/eval` | Lane B evaluation runner, release gate and scorecard |
| `packages/contracts` | Shared Zod schemas and TypeScript types, contract version 0.3.3 |
| `packages/agents` | Advocates, tool loops, Risk Analyst, Judge orchestration, cancellation and action validation, workflow version 0.3.3 |
| `examples` | Development contract payloads; not golden fixtures |
| `fixtures` | Reserved for partner-supplied complete fixtures |
| `tests/evaluation` | Reserved for partner's expected outcomes/evaluation |
| `docs/evidence` | Genuine Buddy development screenshots and captions |

See the [architecture diagram](docs/architecture.png) (source and narrative in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §11), [API and workflow contracts](docs/CONTRACTS.md), [readiness checklist](docs/READINESS.md), and the existing [two-lane execution plan](Ryde_Two_Lane_Execution_Plan.md).

## Repository map

| Location | Purpose |
|---|---|
| `packages/evidence` | Lane B evidence layer: geo/money/time helpers, GPS/chat/fare metrics, evidence builder, risk signals, case features, precedent matching, synthetic fixtures and demonstration policy in `packages/evidence/data` |
| `packages/eval` | Lane B evaluation runner: checks, plan sets, release gate and scorecard (`npm run eval`) |
| `apps/web` | Lane B single-screen React UI (Vite 8 + React 19), polls `/api` and exports case files |
| `harness/` | Lane B task cards (`harness/tasks/`), specification (`harness/spec/`), status (`harness/STATUS.md`) and audit scripts |
| `submission/` | Submission package: identity, description, presentation outline, demo script, cover SVG, checklist and measured metrics (`submission/metrics/`) |

## Current verification and pending work

The 15 October 2026 verification on the integrated branch passed 924 root tests across 51 files, 104 web tests across 10 files, package builds, strict TypeScript checks and the contract examples (`npm run verify`). The live release gate passed with the real model on 13 October 2026 (run `20261013-144417`, 27/27 runs, 20/20 fixtures; see `submission/metrics/`).

[Lane A status](docs/LANE_A_STATUS.md) is the historical Lane A record from 11 October 2026 (67 tests at that time). Remaining human steps are listed in `submission/CHECKLIST.md`.

## Model configuration

Keep `MODEL_API_KEY`, `MODEL_BASE_URL`, and `MODEL_NAME` private in `.env` or backend environment variables. The restored bootstrap can fill missing values from a matching private `~/.codebuddy/models.json` entry. Explicit runtime settings win; a fallback key is not combined with an unrelated endpoint.

`ESCALATION_CONFIDENCE_THRESHOLD` (default `0.80`, range 0–1) sets the model-assessed-confidence floor below which a completed live run is escalated for human review; high risk assessments escalate regardless.

```sh
npm run check:model
RUN_MODE=live npm run dev
```

The current runtime model is `MiniMax-M3` through MiniMax's OpenAI-compatible endpoint (`MODEL_BASE_URL=https://api.minimax.io/v1`, `MODEL_NAME=MiniMax-M3`). An earlier connectivity check with the previous MiniMax Configuration returned HTTP 401. The MiniMax-M3 connection is verified in Lane B task LB-011 with `npm run check:model`.

Live callbacks and tool execution are exercised by mocked model responses in the tests. The real three-agent smoke tests (LB-11), the golden cases (LB-10) and the live release gate (LB-15) have passed; the integration is complete. All evidence and calculations use synthetic data and a demonstration policy; no actual payments are executed.

## Replay mode (demo safety net)

`RUN_MODE=replay npm run dev` serves the recorded events of a past live release-gate run (default `apps/api/replays/20261013-144417`, MiniMax-M3, synthetic fixtures, demonstration policy) — no model is called and `MODEL_*` is not required. `REPLAY_DIR` selects the recording folder (relative to the repo root) and `REPLAY_SPEED` divides each recorded event offset (`REPLAY_SPEED=20` plays a ~20 s run in ~1 s).

In replay mode the data, money calculations, precedent matching and human-review endpoints are real server behaviour — only the agent outputs are re-emitted from the recording. The UI header reads `Replay of live run · recorded <date>`; every run gets a shareable deep link (`?run=<id>`) and the case bar lists recent runs from `GET /api/runs`. See `apps/api/replays/README.md` to refresh the recording after a new passing gate.

## Deterministic verdict and automatic re-run (contract 0.3.2)

Before the agents start, the evidence layer computes a deterministic `PolicyVerdict` from the case features (`packages/evidence/src/verdict.ts`), and `apps/api/src/finalisation.ts` compares the Judge's remedy to it: a match finalises, a mismatch or an undetermined verdict completes the run as an escalated recommendation with a `divergence` record — a human then confirms, overrides, or applies the policy verdict on the bench. A completed unescalated run can never disagree with the verdict (`VERDICT_INVARIANT`). Separately, any first-attempt workflow failure — provider-side (attempt timeout, network error, run deadline) or model-output (invalid JSON, bad schema, bad citations) — gets exactly one automatic re-run, except an internal invariant violation (`VERDICT_INVARIANT`) or a replay-integrity failure (`REPLAY_INVALID`). The failed run carries `retriedBy`, the re-run carries `retryOf`, and both the eval runner and the UI follow the link. See `docs/ARCHITECTURE.md` §11.3.
