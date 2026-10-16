# FairTrip — Ryde multi-agent dispute resolution

FairTrip is a prototype for the **Ryde — Multi-Agent Autonomous Dispute Resolution System** case study (Tencent Cloud AI Singapore Hackathon 2026, Digital Native Track). A filed ride-hailing dispute is argued by a **Rider Advocate** and a **Driver Advocate**, who gather GPS, chat, payment and history evidence through tools and build cited cases. An impartial **Judge** weighs both cases against policy and selects a remedy. A **Risk Analyst** runs alongside and reports context-only bad-faith signals. The server computes every amount deterministically, applies a policy verdict check, escalates low-confidence or high-risk rulings to a human reviewer, and records precedents. The whole exchange is observable in a web UI.

Two dispute categories work end to end: **route deviation** and **no-show charge**.

All dispute data is **SYNTHETIC DATA**. The rules applied are a **DEMONSTRATION POLICY**, not Ryde policy. Route comparisons use a **reference route**. Confidence values are **model-assessed confidence**. No payments are executed.

## Requirements

- **Node 22.23.3 and npm 10.9.9, exactly.** The versions are pinned in `package.json` (`engines`), `.nvmrc` and `.node-version`, and `.npmrc` sets `engine-strict=true`, so `npm ci` refuses any other version.
- A model API key is needed **only for live mode**. Stub and replay modes, and the recorded scenarios in the UI, run fully offline.

```sh
nvm install 22.23.3 && nvm use      # or: fnm use / n 22.23.3
npm install -g npm@10.9.9
node -v && npm -v                   # v22.23.3 and 10.9.9
```

## Quick start

```sh
npm ci
npm run verify                      # typecheck, tests, builds, contract examples, web checks
```

Then start the API in one terminal and the web UI in another:

```sh
RUN_MODE=replay npm run dev         # API at http://127.0.0.1:3001, no model key needed
npm run dev:web                     # UI at http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173`. The hearing room opens in **Explore cases**, which plays bundled recordings and never calls the API; switch to **Live hearing** to run against the API you just started. Pick a case (for example **R1**, a route deviation, or **N2**, a no-show charge) and start the hearing. Watch both advocates request evidence, the cases hand over to the Judge, the ruling and the server-computed amount appear, and the explanations to each party. **N2H** escalates to human review; **X1** has no GPS record and ends without a ruling or amount.

### Run modes

| Mode | Command | What it does | Model key |
|---|---|---|---|
| Replay (default for demos) | `RUN_MODE=replay npm run dev` | Re-emits the recorded events of a passing live run (`apps/api/replays/20261013-144417`, MiniMax-M3). Evidence, money, policy verdict, precedents and human review are real server behaviour; only the agent text is recorded. | No |
| Live | `RUN_MODE=live npm run dev` with `MODEL_*` set in `.env` | Calls the configured model for all four agents. | Yes |
| Stub | `RUN_MODE=stub npm run dev` | Serves labelled contract examples with fixed output; no adjudication. Useful for API and UI development only. | No |

The web UI also has an **Explore cases** mode that plays validated recordings of all 20 synthetic scenarios without any API running.

### Live mode configuration

```sh
cp .env.example .env
# edit .env: RUN_MODE=live, MODEL_API_KEY, MODEL_BASE_URL, MODEL_NAME
npm run check:model                 # one round trip to the configured endpoint
npm run dev
```

The endpoint must be OpenAI-compatible over HTTPS. The project was verified with `MiniMax-M3` at `https://api.minimax.io/v1`; `MODEL_EXTRA_BODY='{"reasoning_split":true}'` is required for that provider. See `.env.example` for the optional settings (thinking depth, escalation threshold, replay folder and speed). Never commit `.env`.

### Evaluate against the expected outcomes

With a live API running:

```sh
npm run eval -- --fixtures release --release-gate
```

The runner replays every fixture against the API, checks status, remedy, exact amount, citations, trace completeness and risk signals, enforces a release gate and writes a scorecard under `packages/eval/results/`. The scorecard from the last passing gate is in `submission/metrics/`.

## What you will see

- **Case bar / Case segment** — pick a synthetic fixture, read the rider claim and driver statement, start the hearing.
- **Hearing lines** — the Rider Advocate, Driver Advocate and Risk Analyst lanes leave the trunk as they gather evidence and rejoin at the Judge handoff; every tool request, retrieved record and case is an event in the full activity log.
- **Advocate columns** — requested remedy, case summary, arguments with evidence and policy chips, counterevidence and missing facts.
- **Verdict / bench** — ruling, recommended action (computed by the server, never by the model), model-assessed confidence, reasoning, and a plain-language explanation to the rider and to the driver (in the hearing-room UI these sit under the **Party explanations** disclosure in the Judge column; click it to open). Escalated runs show **Confirm ruling** / **Override…** controls for a human reviewer; overrides are written back as precedents.
- **Evidence locker and policy** — route-vs-reference, pickup and fare gauges above the GPS, chat, payment and history records, and the demonstration-policy clauses cited.

The original single-screen interface remains at `/classic.html`.

## Repository map

| Location | Purpose |
|---|---|
| `packages/contracts` | Shared Zod schemas and TypeScript types for disputes, evidence, cases, rulings, actions and events |
| `packages/agents` | Rider/Driver Advocate tool loops, Judge orchestration, Risk Analyst, prompts, output normalisation and remedy validation |
| `packages/evidence` | Evidence layer: GPS route and pickup metrics, chat analysis, fare checks, money formulas, risk signals, precedent matching, deterministic policy verdict; synthetic fixtures and demonstration policy in `packages/evidence/data` |
| `apps/api` | Express API: run lifecycle, live/stub/replay modes, finalisation and escalation, human review, precedent store; recorded run in `apps/api/replays` |
| `apps/web` | React/Vite UI: hearing-room interface in `src/glass`, classic interface in `src/components` |
| `packages/eval` | Evaluation runner, release gate and scorecard (`npm run eval`) |
| `examples` | Contract example payloads validated by `npm run check:examples` |
| `scripts` | Setup, model connectivity and demo-scenario capture scripts |
| `tests` | Workflow, API, integration (golden flow, replay, verdict) and adversarial test suites |
| `harness` | CodeBuddy development harness: task cards, specification, golden-value audit scripts and the archived challenge requirements |
| `docs` | `ARCHITECTURE.md` and `architecture.png`, `CONTRACTS.md`, and the CodeBuddy development-chat captures in `docs/evidence` |
| `submission` | Project identity, description, presentation outline, demo script and video, cover image, checklist and measured metrics |

## Commands

| Purpose | Command |
|---|---|
| Install locked dependencies | `npm ci` |
| Everything (typecheck, tests, builds, examples, web, setup check) | `npm run verify` |
| Root tests | `npm test` |
| Web checks | `npm run verify:web` |
| Build library packages and the API | `npm run build` |
| API | `npm run dev` (reads `.env` if present) |
| Web UI | `npm run dev:web` |
| Model connectivity | `npm run check:model` |
| Evaluation | `npm run eval -- --fixtures release --release-gate` |
| Offline single-file UI preview | `cd apps/web && ../../node_modules/.bin/vite build --config vite.glass.config.ts` → `apps/web/dist/glass-preview/preview.html` |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) and the [architecture diagram](docs/architecture.png)
- [API and workflow contracts](docs/CONTRACTS.md)
- [Web UI guide](apps/web/README.md) and the [hearing-room UI notes](apps/web/src/glass/README.md)
- [Submission package](submission/) — [description](submission/description.md), [checklist](submission/CHECKLIST.md), [demo script](submission/demo-script.md), [measured metrics](submission/metrics/README.md)
- [CodeBuddy development evidence](docs/evidence/README.md) — the project was built in CodeBuddy desktop; `CODEBUDDY.md`, `.codebuddy/` and `harness/` hold the task-card workflow used

## Safety properties

- The model selects a remedy ID; the server computes the money in integer SGD cents and caps it at the amount paid.
- A completed, unescalated run can never disagree with the deterministic policy verdict; a divergence is escalated to a human, never finalised.
- Missing decisive evidence (GPS or payment) ends a run `incomplete` with no ruling and no amount, whatever the model said.
- Chat text is evidence only; instruction-like messages are badged in the UI and never obeyed by the agents.
- A first-attempt workflow failure gets exactly one automatic re-run; both attempts stay visible and a re-run can never pay twice.
