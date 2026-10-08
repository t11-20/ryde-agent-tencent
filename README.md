# FairTrip — setup foundation

Lane A and shared prerequisites for the Ryde dispute-resolution prototype. The current API runs **development stubs only**. Live model access is pending the partner's update; real dispute policies, fixtures, evidence payloads, UI, and golden evaluations remain partner-owned.

## Run locally

The permanent project folder is `/Users/edward/Documents/ChatGPT/Tencent`. Open this folder in CodeBuddy and run commands from it. Only this project folder remains under `/Users/edward/Documents/ChatGPT`.

Use Node **22.23.3** and npm **10.9.9**. Node 22 remains supported until April 2027: [official release schedule](https://github.com/nodejs/Release).

```sh
cd /Users/edward/Documents/ChatGPT/Tencent
npm ci
npm run verify
npm run dev
```

The API listens at `http://127.0.0.1:3001`. No `.env` is required for stub mode. Copy `.env.example` to `.env` when configuration is needed. Do not commit populated environment files.

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
| `apps/api` | Lane A Express stub API and model connectivity adapter |
| `apps/web` | Partner's reserved React/Vite package; no UI implementation |
| `packages/contracts` | Shared Zod schemas and TypeScript types, version 0.1.0 |
| `packages/agents` | Lane A fixed workflow foundation, version 0.1.0 |
| `examples` | Development contract payloads; not golden fixtures |
| `fixtures` | Reserved for partner-supplied complete fixtures |
| `tests/evaluation` | Reserved for partner's expected outcomes/evaluation |
| `docs/evidence` | Genuine Buddy development screenshots and captions |

See [API and workflow contracts](docs/CONTRACTS.md), [readiness checklist](docs/READINESS.md), and the existing [two-lane execution plan](Ryde_Two_Lane_Execution_Plan.md).

## Model configuration — pending

The partner must confirm provider, region/account site, HTTPS API base URL (including the provider's `/v1` path), model name, and credential access. Configure `MODEL_API_KEY`, `MODEL_BASE_URL`, and `MODEL_NAME` privately in `.env` or backend environment variables, then run:

```sh
npm run check:model
```

This makes one real chat-completions request and logs only success or sanitized diagnostics. CodeBuddy/WorkBuddy product access is separate from runtime API access. Do not place keys in frontend environment variables.

Tencent Hunyuan was selected provisionally. New service onboarding goes through TokenHub; use the endpoint for the actual account region and a model listed as available to that account. Do not reuse retired model IDs from old tutorials. [TokenHub migration](https://cloud.tencent.com/document/product/1823/131382), [current API guide](https://cloud.tencent.com/document/product/1823/130078).

Successful connectivity does not implement the three live agents. The setup API intentionally refuses `RUN_MODE=live` until the production role/tool runner is implemented. Never silently fall back from a live run to stub output.
