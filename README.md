# ryde-agent-tencent — FairTrip

FairTrip — the Ryde dispute-resolution prototype. Lane A provides the three-agent workflow (Rider Advocate, Driver Advocate, Judge) and the Express API; Lane B adds the evidence layer (`@fairtrip/evidence`), the web UI (`apps/web`) and the evaluation runner (`packages/eval`). Stub mode runs offline with Lane A's labeled contract examples. Live mode runs the three agents against Lane B's synthetic fixtures and demonstration policy, with deterministic server-side money and an observable UI.

The collaboration repository's `main` branch combines the original repository history, the verified Lane A snapshot and the integrated Lane B work. `origin/lane-b` is abandoned work and must not be used.

## Run locally

Use Node **22.23.3** and npm **10.9.9**. Node 22 remains supported until April 2027: [official release schedule](https://github.com/nodejs/Release).

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

Use the returned ID with `GET /api/runs/ID?after=0`. Runs are stored in memory and disappear on restart. The stub accepts edited claims but returns fixed, labeled development output; it does not evaluate their merits or execute payments. Final `ruling: incomplete` is intentional: a completed stub response is not a completed real adjudication.

## Run the full demo

Use Node **22.23.3** and npm **10.9.9**.

```sh
npm ci
npm run verify
cp .env.example .env   # add your own MODEL_API_KEY / MODEL_BASE_URL / MODEL_NAME; never commit .env
npm run dev            # terminal 1: API at http://127.0.0.1:3001 (RUN_MODE=live in .env)
npm run dev:web        # terminal 2: web UI at http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173`, pick a fixture (for example R1), click **Resolve dispute** and watch the advocates gather evidence, the Judge rule, and the server compute the amount. All dispute data is SYNTHETIC DATA and the rules applied are a DEMONSTRATION POLICY.

With the API running, evaluate the live system against the expected outcomes:

```sh
npm run eval -- --fixtures release --release-gate
```

## CodeBuddy desktop development

Use CodeBuddy desktop's **Open Folder** command to open <Project-Folder>. Run the local commands above in its integrated terminal.

CodeBuddy 4.12.1 installation, running state, and the open Tencent project were verified on 8 October 2026. The [project-open screenshot](docs/evidence/00-project-open.png) records folder access. A successful signed-in agent response and the three genuine development-chat captures remain pending; follow the [capture tasks](docs/evidence/README.md).

The desktop workflow does not require CNB or a separate CodeBuddy CLI installation. Existing `.cnb.yml` and `.ide/Dockerfile` files are optional cloud configuration and have not been built or launched. [Alternative CLI Web UI documentation](https://www.codebuddy.ai/docs/cli/web-ui).

## Contents and ownership

| Location | Purpose |
|---|---|
| `apps/api` | Lane A Express API, live role callbacks, and model adapter |
| `apps/web` | React/Vite single-screen UI (Lane B) |
| `packages/evidence` | Lane B evidence layer: calculations, evidence builder, synthetic fixtures and demonstration policy |
| `packages/eval` | Lane B evaluation runner, release gate and scorecard |
| `packages/contracts` | Shared Zod schemas and TypeScript types, contract version 0.2.0 |
| `packages/agents` | Advocates, tool loops, Judge orchestration, cancellation and action validation, workflow version 0.2.0 |
| `examples` | Development contract payloads; not golden fixtures |
| `fixtures` | Reserved for partner-supplied complete fixtures |
| `tests/evaluation` | Reserved for partner's expected outcomes/evaluation |
| `docs/evidence` | Genuine Buddy development screenshots and captions |

See [API and workflow contracts](docs/CONTRACTS.md), [readiness checklist](docs/READINESS.md), and the existing [two-lane execution plan](Ryde_Two_Lane_Execution_Plan.md).

## Repository map

| Location | Purpose |
|---|---|
| `packages/evidence` | Lane B evidence layer: geo/money/time helpers, GPS/chat/fare metrics, evidence builder, synthetic fixtures and demonstration policy in `packages/evidence/data` |
| `packages/eval` | Lane B evaluation runner: checks, plan sets, release gate and scorecard (`npm run eval`) |
| `apps/web` | Lane B single-screen React UI (Vite 8 + React 19), polls `/api` and exports case files |
| `harness/` | Lane B task cards (`harness/tasks/`), specification (`harness/spec/`), status (`harness/STATUS.md`) and audit scripts |
| `submission/` | Submission package: identity, description, presentation outline, demo script, cover SVG, checklist and measured metrics (`submission/metrics/`) |

## Current verification and pending work

The 11 October 2026 audit passed 67 tests across nine files, package builds, strict TypeScript checks, contract examples, setup checks, and an actual development-server smoke test for both offline categories. A clean source copy also passed a fresh locked dependency install and verification.

See [Lane A status](docs/LANE_A_STATUS.md) for the measured results and pending gates. CodeBuddy's saved live wiring and model bootstrap were restored to the local Lane A source without merging Lane B.

## Model configuration

Keep `MODEL_API_KEY`, `MODEL_BASE_URL`, and `MODEL_NAME` private in `.env` or backend environment variables. The restored bootstrap can fill missing values from a matching private `~/.codebuddy/models.json` entry. Explicit runtime settings win; a fallback key is not combined with an unrelated endpoint.

```sh
npm run check:model
RUN_MODE=live npm run dev
```

The current runtime model is `MiniMax-M3` through MiniMax's OpenAI-compatible endpoint (`MODEL_BASE_URL=https://api.minimax.io/v1`, `MODEL_NAME=MiniMax-M3`). An earlier connectivity check with the previous MiniMax Configuration returned HTTP 401. The MiniMax-M3 connection is verified in Lane B task LB-011 with `npm run check:model`.

Live callbacks and tool execution are exercised by mocked model responses in the tests. The real three-agent smoke tests, shared golden cases and Lane B integration remain pending. Current evidence and calculations are labeled examples; no actual payments are executed.
