# Setup readiness

Statuses record verified facts, not assumed completion. The permanent project folder is `/Users/lane-a-owner/Documents/ChatGPT/Tencent`; the previous empty repository was deleted and the working project was renamed. Private runtime configuration is present, but the latest MiniMax connectivity check failed with HTTP 401; authenticated operation remains unverified. No authentic case data are used. The project-open screenshot is recorded, while genuine development-chat evidence remains pending.

| Prerequisite | Owner | Status | Evidence / remaining gate |
|---|---|---|---|
| Matching Node/npm | Both | Local runtime verified; partner pending | Node 22.23.3 and npm 10.9.9 are pinned. Both lanes must run check:setup. |
| Repository structure | Both | Local scaffold prepared | npm workspaces for API/web/contracts/agents; examples, fixture and evaluation slots. A cloud repository is optional. |
| Environment handling | Lane A | Local handling tested; real-provider checks deferred | Private runtime fields and matching CodeBuddy model settings exist; the earlier check:model returned HTTP 401. Further credential checks are deferred at the user's request. |
| Agent framework | Lane A | Locally verified with mocked model responses | Workflow 0.2.0; live callbacks, independent tools, Judge context, cancellation and incomplete/deadline handling tested. Authenticated acceptance remains pending. |
| Shared Zod contracts | Lane A + partner | Implemented; paired review pending | Eight contracts and inferred types; partner-owned detailed evidence payloads remain open. |
| Example payloads | Both | Local examples prepared; partner review pending | Both categories, four evidence envelopes, both advocates, Judge, action, event, full run validation. |
| Stub API | Lane A | Locally verified | Both categories, run creation/polling, error responses and concurrent run isolation tested; explicit stub labels and offline operation. |
| Buddy access/evidence | Both | Project open verified; agent access and development captures pending | CodeBuddy desktop 4.12.1 has the renamed Tencent project open. Native window inspection and 00-project-open.png verify the Explorer contents. Keyboard automation was blocked by macOS, so no successful agent response or three development captures are claimed. |

## Current verification — 11 October 2026 (Kuala Lumpur)

- Updated local Lane A: 67 tests across nine files, typechecks, builds, contract examples and setup checks passed.
- A clean source copy passed the locked dependency install and full verification with all 67 tests; results are recorded in [Lane A status](LANE_A_STATUS.md).
- The actual development server started in stub mode on an isolated local port. Health, fixture listing, both category runs, and sequence polling passed.
- `check:model` reached the configured MiniMax provider and returned HTTP 401. Further credential investigation and real-model execution are deferred at the user's request.
- Lane B remains separate. The old combined history and post-merge edits are preserved in the local backup branch and stash.
- The detailed current package status and outstanding Lane A/shared gates are in [LANE_A_STATUS.md](LANE_A_STATUS.md). Historical foundation notes below do not supersede that record.

## Folder status

- **Canonical folder:** `/Users/lane-a-owner/Documents/ChatGPT/Tencent`.
- **Filesystem:** one Tencent project folder remains; its original Git metadata and relative npm workspace links are intact. The Codex trust configuration uses this path.
- **Codex interface:** the project is named Tencent, but its saved folder and the existing chats' recorded working directories still refer to the former name. The two tooltip rows represent a project label and a working-directory record.
- **Remaining app correction:** use Tencent → Edit project to select the canonical folder and make it primary. Existing chats may retain their original directory; new chats use the corrected primary folder. Desktop control rejects automating Codex itself, so the interface correction is pending rather than claimed complete.

## External gates

1. Verify CodeBuddy signed-in agent access with a successful review of project files. Installation, running state and the open Tencent project are verified; an agent response is still pending.
2. Perform real development/debugging in CodeBuddy desktop and collect readable screenshots with captions. At least three are required across project development checkpoints by the existing execution plan; none are claimed so far.
3. Both people confirm runtime versions and Buddy access. Partner contract review is necessary before a shared freeze.
4. Real-provider checks are deferred at the user's request. When resumed, validate the private configuration and run check:model successfully; the earlier result was HTTP 401.

## Partner verification and contract review

These are shared-team checks, separate from live API credentials and from partner-owned implementation work.

**Partner verification** means the partner independently checks the same project revision/setup on their machine or development environment:

- [ ] Confirm Node 22.23.3 and npm 10.9.9.
- [ ] Run `npm ci`, `npm run verify`, and `npm run dev` successfully.
- [ ] Confirm usable CodeBuddy access and that project files are readable by its agent.
- [ ] Use `/api/fixtures`, create a stub run with `/api/runs`, then poll `/api/runs/:id` with the event sequence cursor. Confirm the UI/data work can consume the responses and explicit stub labels.
- [ ] Record the actual commands/results, date and project revision or shared archive used. Partner evidence is pending until supplied.

**Contract review** means the Lane A owner and the partner jointly agree on the shared interfaces before treating contract version 0.2.0 as frozen:

- [ ] Review `packages/contracts/src/index.ts`, `docs/CONTRACTS.md`, and the valid payloads in `examples` together.
- [ ] Agree field names, required/optional fields, IDs, category/status enums, ISO timestamps, and money as integer SGD cents.
- [ ] Agree how the partner's GPS/chat/payment/history payloads fit the shared Evidence envelope. Detailed evidence schemas/data remain partner-owned.
- [ ] Confirm AdvocateCase, JudgeResult and FinalAction fields support the planned UI and agree on remedy/ruling meanings.
- [ ] Agree API request/response shapes, `/api` prefix, event sequence/deduplication and terminal statuses. Preserve the distinction between stub output and real adjudication.
- [ ] Validate the agreed example payloads with `npm run check:examples`, record any changes, and obtain both people's explicit approval of the final contract version.

Completion evidence is a dated review note from both people, the reviewed contract version/revision, observed partner setup results, and any unresolved field or integration decisions. This checklist does not imply the partner has already approved it.

## Scope exclusions

Ignore work assigned solely to Owner: You (the partner): demonstration policies, synthetic category fixtures, detailed evidence schema/data, UI shell, and golden evaluation cases. Only shared envelopes, contract examples and placeholder locations are supplied here.

## Verified on 8 October 2026 (Singapore)

- Full local verification passed from the renamed Tencent folder: strict TypeScript checks, 23 tests across four files, all implemented package builds, shared examples and setup checks.
- A clean source copy passed `npm ci` and full verification. Exact dependency versions are recorded in `package-lock.json`; the installation audit reported zero advisories at that check.
- `npm run check:setup` passed again after the folder-path update. Node 22.23.3 and npm 10.9.9 match the project pins.
- Git exclusions cover populated `.env` files and private evidence captures; `.env.example` remains shareable.
- The stub API started on `127.0.0.1:3001`. Live model connectivity remains pending; `check:model` correctly reported missing configuration without making a live request.
- CodeBuddy desktop 4.12.1 and its open Tencent project were verified. The archived screenshot establishes project access only; signed-in agent access and development-chat evidence remain pending.

The local prerequisite scaffold is verified. Remaining gates are recorded above: the Codex interface reference, CodeBuddy agent access/development captures, partner verification/contract review, and live model credentials/connectivity.
