# FairTrip — rules for the coding agent (read at the start of every chat)

You are implementing **Lane B** of FairTrip, a Ryde multi-agent dispute-resolution prototype, inside an existing TypeScript monorepo. **Lane A is already built and tested on `main`**: shared contracts, the Rider Advocate / Driver Advocate / Judge workflow, and the Express API. Your job is to add the evidence layer, connect it to Lane A, build the web UI and the evaluation runner, and prepare submission material, by following the task cards in `harness/tasks/`.

## How to work

1. Do exactly ONE task per chat: the card the human names (for example `harness/tasks/LB-03.md`).
2. Read in this order: this file, the task card, then only the spec files for the sections the card lists (`harness/SPEC.md` is the index; the files are in `harness/spec/`).
3. Open `harness/STATUS.md`. Every task under the card's **Requires** must be `DONE`. If not, STOP.
4. Before writing code, state your plan in 3–8 lines: the files you will create or modify (they must all be in the card's **Files** list) and the order of steps. Then carry on.
5. Work step by step. After each step, run that step's check. Fix only the files the card allows.
6. Finish with every command under **Verify**, tick the **Acceptance** list, set the task to `DONE` in `harness/STATUS.md` with the commit hash, commit with the card's message, and send the report below.

## Hard rules

- Create or modify **only** the files listed under **Files** in the current card. If a fix seems to need another file, STOP and report.
- Never edit `.nvmrc`, `.node-version`, `.npmrc`, any `engines` field, `.env` or `.env.*` (except where a card lists `.env.example`), or anything in `harness/` other than `harness/STATUS.md`. Never hand-edit `package-lock.json`; it changes only through `npm install`.
- Never weaken, skip or delete a test to make it pass. Never change the data files in `packages/evidence/data/` or any golden number. The data and the numbers in `harness/SPEC.md` are authoritative: if your result differs, your code is wrong.
- Never read, print or commit secrets. Do not open `.env`. Never write an API key into code, tests, docs or chat.
- Never check out, read, diff, cherry-pick or merge `origin/lane-b`. It is abandoned work and must not be used. Never force-push, rebase pushed commits or rewrite history.
- Install only packages a card names, always with the exact version: `npm install -w <workspace> <package>@<version>`. Never run `npm audit fix`, `npm update` or `npm install <pkg>@latest`.
- Do not start long-running processes (`npm run dev`, `npm run dev:web`, `vite`). When a card needs a running server, ask the human to start it in a separate terminal and wait for them to reply "server is running".
- Do not invent APIs or file contents. When unsure, read the existing file the card points to and follow its pattern.
- Lane A files (`packages/contracts/src/*`, `packages/agents/src/*`, `apps/api/src/*`, `scripts/*`, root `package.json`, root `tsconfig.json`, files in `tests/` that you did not create) may be changed only when the card lists them, and only in the way the card describes.

## Project facts

- Node **22.23.3** and npm **10.9.9** exactly. `npm run check:setup` enforces this. If the versions differ, STOP and tell the human; never change the version pins.
- npm workspaces: `apps/*` and `packages/*`. Always run `npm install` from the repository root.
- Workspaces: `@fairtrip/contracts` (Lane A, Zod schemas), `@fairtrip/agents` (Lane A, workflow), `@fairtrip/api` in `apps/api` (Lane A, Express server), `@fairtrip/evidence` in `packages/evidence` (yours), `@fairtrip/web` in `apps/web` (yours), `@fairtrip/eval` in `packages/eval` (yours).
- Packages other code imports (`contracts`, `agents`, `evidence`) are consumed through their built `dist/` folders. Run `npm run build` after changing them, before running anything that imports them.
- API: `http://127.0.0.1:3001`, routes under `/api`. Web dev server: `http://127.0.0.1:5173`, which proxies `/api` to the API.
- All data is SYNTHETIC. The policy is a DEMONSTRATION POLICY, never "Ryde policy". The comparison path is a "reference route", never an "optimal route".

## TypeScript rules (the compiler is strict)

- ESM everywhere. **Every relative import ends in `.js`**, even when the target file is `.ts` or `.tsx`: `import { routeMetrics } from './route.js';`
- Use `import type { X } from '...'` for type-only imports. Use `node:` for built-ins: `import { readFileSync } from 'node:fs';`
- No `any`. Parse unknown data with Zod **v4**: `z.strictObject`, `z.object`, `z.enum`, `z.iso.datetime()`, `z.looseObject`. Do not use Zod v3 APIs such as `.passthrough()` or `z.string().datetime()`.
- `noUncheckedIndexedAccess` is on, so `arr[0]` has type `T | undefined`. Check it: `const first = arr[0]; if (first === undefined) throw new Error('empty');`
- `exactOptionalPropertyTypes` is on. Never assign `undefined` to an optional property; leave the key out instead.
- Evidence `facts` must be plain JSON: numbers, strings, booleans, `null`, arrays and objects. Never `undefined`, `NaN` or `Infinity`. Use `null` for "no value".
- Money is integer SGD cents. Use `divHalfUp` (SPEC §5.2) for every division involving money. Never store or compute money as a float.

## Commands

| Purpose | Command |
|---|---|
| Install after any `package.json` change | `npm install` |
| Build all library packages and the API | `npm run build` |
| Typecheck (builds dependencies first) | `npm run typecheck` |
| Root tests: Lane A, integration, packages | `npm test` |
| One test file | `npx vitest run packages/evidence/test/route.test.ts` |
| Web checks (after LB-12) | `npm run verify:web` |
| Everything | `npm run verify` |

## STOP and report when

- the same command still fails after 3 attempts at fixing it;
- a fix needs a file outside the card's **Files** list;
- a golden-number assertion fails and you cannot find the bug in your own code;
- git reports a conflict, or `git status` shows changes you did not make;
- a live model call fails (HTTP 401, 403, 404, 400, 429, or a timeout).

When you stop: set the task to `BLOCKED` in `harness/STATUS.md` with the exact first error line, do not commit broken code, and send the report.

## Report format (end every task with this block)

```
TASK: LB-xx — <title>
RESULT: DONE | BLOCKED
FILES: <created and modified paths>
VERIFY: <command> → PASS | FAIL (<key output line>)    one line per command
ACCEPTANCE: all ticked | <list of unticked items>
NOTES: <decisions, deviations, questions> | none
SCREENSHOT MOMENT: yes | no   (copied from the card)
```
