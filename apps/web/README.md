# @fairtrip/web

Single-screen React UI for FairTrip. It shows the dispute, both advocates' tool activity and cases, the timeline (with
the handoff to the Judge), the evidence and DEMONSTRATION POLICY clauses, the Judge's ruling, and the recommended action.

## Run

```bash
npm ci
npm run dev        # live mode: talks to Lane A's API through the Vite proxy
npm run dev:mock   # DEV MOCK mode (development only; same as VITE_API_MODE=mock)
npm run contracts:build   # regenerate docs/lane-b/contracts (JSON Schemas + example responses)
npm test && npm run typecheck && npm run build
```

`predev`, `pretest`, `pretypecheck` and `prebuild` build `@fairtrip/evidence` if its `dist/` is missing, so a clean clone works.

## Modes

- **live** (default): calls `GET /api/fixtures`, `POST /api/runs` and `GET /api/runs/:id?after=<seq>`.
  - Every response is parsed with Zod (loose objects).
  - A response that does not match the contract shows a visible **Contract mismatch** state. It never shows "no action".
- **mock** (`VITE_API_MODE=mock`) is for development only and is off by default.
  - It uses the **real** fixtures and the real `buildEvidence` / tool calls, so evidence and amounts are genuine computations.
  - Only the agent outputs and event timing are scripted.
  - A persistent banner reads "DEV MOCK: agent activity is scripted, not live."
  - Every event is `dev: true` and starts with `[DEV MOCK]`.
  - Scripted runs:

    | Run | Outcome |
    |---|---|
    | R1 | completed, refund S$1.98 |
    | R1 | provider timeout (failed) |
    | R1 | unknown citation (failed validation) |
    | N2 | completed, keep charge |
    | X1 | incomplete |

    Any other fixture fails visibly in mock mode.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_MODE` | `live` | `live` or `mock` (`vite --mode mock` also enables mock) |
| `VITE_API_BASE` | `""` | Prefix for API calls. Empty means same origin, forwarded by the dev proxy |
| `VITE_API_PROXY_TARGET` | `http://localhost:3001` | Where the Vite dev proxy forwards `/api` |

See `.env.example`. Never commit `.env` files.

## Behaviour notes

- **Polling:**
  - Polls once per second with `after=<highest sequence seen>`.
  - Events are merged and deduped by sequence.
  - Polling stops on `completed` / `incomplete` / `failed`, on unmount, and when a new run starts.
  - After 5 consecutive network errors it shows a failed state with **Keep waiting** and **Stop**.
- **One active run at a time:** Resolve is disabled while a run is active, and double clicks are ignored.
- **Status states:** each has its own visible state:
  - idle
  - submitting
  - running (elapsed timer + 90 s deadline bar)
  - completed
  - incomplete (missing evidence listed, **no amount**)
  - failed (error + Run again)
  - stalled
  - contract mismatch

  The action card is shown **only** for `completed` with a result.
- **Citation chips:** clicking one scrolls to the record and highlights it. A chip whose ID is not in the run's evidence or policy list renders as **unresolved** (red, dashed, ⚠).
- **Untrusted text:** evidence text is always rendered as text, never as HTML, and instruction-like messages carry a warning badge.
- **No chain-of-thought:** the UI shows only public outputs.
- **Export:** downloads `fairtrip-<fixtureId>-<runId>.json` with the dispute, status, events, evidence, clauses, cases, result, error, missing evidence, usage, mode and `exportedAt`.

`src/contracts/provisional.ts` is a **PROVISIONAL mirror of Lane A contracts**. Replace it with Lane A's package at integration.
Its JSON Schemas and example responses are published for Lane A in `docs/lane-b/contracts/`. See `docs/lane-b/LANE_A_GUIDE.md`.

The Judge's confidence is expected in `[0, 1]`. Off-scale values are shown as given and flagged, never rescaled.

## Demo operator script (projector, 1920×1080)

1. **R1, material detour.**
   - Select **R1** and press **Resolve**.
   - While it runs, point at:
     - both advocates' independent `get_evidence` calls
     - the **handoff to Judge** row in the timeline
   - Click `GPS-ROUTE` in the Judge's findings to jump to the computed route metrics: +2.64 km, threshold 0.80 km.
   - Show the action card: **refund S$1.98**, computed from the remedy basis, not by the model.
   - Read out the separate explanations for the rider and the driver, and the *model-assessed* confidence.
2. **N2, driver waited.**
   - Select **N2** and press **Resolve**.
   - Show `GPS-PICKUP` (33 m, waited 430 s), `CALL-01` and `CHAT-CONTACT` (3 attempts).
   - Show `GPS-RIDER`: the rider was 425 m away.
   - Outcome: **keep charge**. The action card says S$0.00 and "None (charge kept)".
3. **X1, missing GPS.**
   - Select **X1** and press **Resolve**.
   - Show the **Incomplete: human review required** state: `gps` is unavailable and **no amount** is issued (GEN-1).
   - Make the point that the system refuses to guess.
4. *(Optional)* Press **Export run JSON** to show the full trace.

Keep the DEMONSTRATION POLICY and SYNTHETIC DATA badges visible. In mock mode, say clearly that agent activity is scripted.
