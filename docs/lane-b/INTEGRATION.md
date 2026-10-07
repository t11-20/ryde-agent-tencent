# Lane B integration notes

## Repo facts (Phase 0 recon, 2026-10-07)

| Item | Finding / decision |
|---|---|
| `origin/main` | One commit `c447e68` "Initial commit" — contains only `README.md` |
| Remote branches | `main` only. **No Lane A branch exists yet** (expected name `lane-a`) |
| Root `package.json` / workspaces | None → **standalone mode** (section 3.2) |
| Node pin | None (no `.nvmrc`, no `engines`). Lane B packages declare `"engines": { "node": ">=22" }`. Container runs Node 22.22.0 / npm 10.9.4 |
| Contracts package | None on `main` → `apps/web` and `packages/eval` use the provisional mirror (section 7.2) |
| Server location / API port | Not on `main`. Using the agreed suggestion `http://localhost:3001`, routes under `/api` (to confirm with Lane A) |
| Owned paths | None exist on `main` → no STOP |
| Web path | `apps/web/` kept (no repo convention to override it) |

### Versions chosen (nothing pinned upstream)

| Tool | Version |
|---|---|
| TypeScript | 5.9.x (latest 5.x) |
| Zod | 4.x (**Lane A must use Zod 4** — their contracts import our schemas) |
| Vitest | latest (5.x) |
| React / React DOM | 19.x |
| Vite | latest stable (8.x) |
| tsx | 4.x |

## Root changes needed at integration

Lane B never edits root files. At integration, on `main`:

1. *(optional, once a root `package.json` exists)* npm workspaces `["packages/*", "apps/*"]`.
2. When the root lockfile exists, delete the nested `package-lock.json` files under Lane B packages and regenerate the root lockfile **on `main` after each merge**.
3. Until then, each Lane B package installs standalone; cross-package dependencies use `file:` specifiers.

## Merge procedure

1. On `lane-b`: `git fetch origin && git merge origin/main` (never rebase).
2. `docs/lane-b/scripts/check-ownership.sh origin/main`
3. `git merge-tree --write-tree origin/main HEAD` and, if it exists, `git merge-tree --write-tree origin/lane-a HEAD` — both must be clean.
4. Human merges `lane-b` into `main` (Lane B never merges or opens PRs itself).
