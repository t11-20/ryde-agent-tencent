# ryde-agent-tencent — FairTrip

Lane A backend for the Ryde dispute-resolution prototype. Stub mode runs offline. Live mode invokes the two advocates and Judge using Lane A's labeled synthetic evidence and mock calculations. Lane B remains separate; shared contract alignment, real evidence/calculation adapters, UI integration, and golden acceptance are pending.

The collaboration repository's `main` branch combines the original repository history with the verified Lane A snapshot. Backend development continues on `lane-a`; partner work remains on `lane-b` until shared integration.

## Run locally

The permanent project folder is `/Users/edward/Documents/ChatGPT/Tencent`. Open this folder in CodeBuddy and run commands from it. Only this project folder remains under `/Users/edward/Documents/ChatGPT`.

Use Node **22.23.3** and npm **10.9.9**. Node 22 remains supported until April 2027: [official release schedule](https://github.com/nodejs/Release).

```sh
cd /Users/edward/Documents/ChatGPT/Tencent
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

## CodeBuddy desktop development

Use CodeBuddy desktop's **Open Folder** command to open `/Users/edward/Documents/ChatGPT/Tencent`. Run the local commands above in its integrated terminal.

CodeBuddy 4.12.1 installation, running state, and the open Tencent project were verified on 8 October 2026. The [project-open screenshot](docs/evidence/00-project-open.png) records folder access. A successful signed-in agent response and the three genuine development-chat captures remain pending; follow the [capture tasks](docs/evidence/README.md).

The desktop workflow does not require CNB or a separate CodeBuddy CLI installation. Existing `.cnb.yml` and `.ide/Dockerfile` files are optional cloud configuration and have not been built or launched. [Alternative CLI Web UI documentation](https://www.codebuddy.ai/docs/cli/web-ui).

## Contents and ownership

| Location | Purpose |
|---|---|
| `apps/api` | Lane A Express API, live role callbacks, and model adapter |
| `apps/web` | Partner's reserved React/Vite package; no UI implementation |
| `packages/contracts` | Shared Zod schemas and TypeScript types, contract version 0.2.0 |
| `packages/agents` | Advocates, tool loops, Judge orchestration, cancellation and action validation, workflow version 0.2.0 |
| `examples` | Development contract payloads; not golden fixtures |
| `fixtures` | Reserved for partner-supplied complete fixtures |
| `tests/evaluation` | Reserved for partner's expected outcomes/evaluation |
| `docs/evidence` | Genuine Buddy development screenshots and captions |

See [API and workflow contracts](docs/CONTRACTS.md), [readiness checklist](docs/READINESS.md), and the existing [two-lane execution plan](Ryde_Two_Lane_Execution_Plan.md).

## Current verification and pending work

The 11 October 2026 audit passed 67 tests across nine files, package builds, strict TypeScript checks, contract examples, setup checks, and an actual development-server smoke test for both offline categories. A clean source copy also passed a fresh locked dependency install and verification.

See [Lane A status](docs/LANE_A_STATUS.md) for the measured results and pending gates. CodeBuddy's saved live wiring and model bootstrap were restored to the local Lane A source without merging Lane B.

## Model configuration

Keep `MODEL_API_KEY`, `MODEL_BASE_URL`, and `MODEL_NAME` private in `.env` or backend environment variables. The restored bootstrap can fill missing values from a matching private `~/.codebuddy/models.json` entry. Explicit runtime settings win; a fallback key is not combined with an unrelated endpoint.

```sh
npm run check:model
RUN_MODE=live npm run dev
```

The current private settings select MiniMax-M2.5. The live connectivity check returned **HTTP 401**; configured values do not establish successful API authentication. Further credential checks are deferred at the user's request; this audit does not claim authenticated live operation. CodeBuddy product access is separate from runtime API access.

Live callbacks and tool execution are exercised by mocked model responses in the tests. The real three-agent smoke tests, shared golden cases and Lane B integration remain pending. Current evidence and calculations are labeled examples; no actual payments are executed.
