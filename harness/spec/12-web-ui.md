# SPEC §12. Web UI (`apps/web`)

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

Stack: Vite 8, React 19, TypeScript, plain CSS, no UI framework. It talks only to `/api` (the Vite proxy forwards to `http://127.0.0.1:3001`). Responses are parsed with Zod: runs with `RunSchema` from `@fairtrip/contracts`; fixtures and the start-run response with small local loose schemas. A parse failure shows the **Contract mismatch** state and never crashes the page.

### 12.1 Screen (single page, legible on a 1920×1080 projector)

```
┌ Header: "FairTrip" · "Ryde dispute resolution prototype" · badges: DEMONSTRATION POLICY, SYNTHETIC DATA, LIVE MODEL | STUB ┐
├ Left 360 px ────────────┬ Centre ──────────────────────────────────────┬ Right 380 px ───────────┤
│ Dispute                 │ Rider Advocate        │ Driver Advocate       │ Agent activity           │
│  fixture select         │  tool requests        │  tool requests        │  (timeline drawn as a    │
│  category               │  retrieved IDs        │  retrieved IDs        │   transit line: one dot  │
│  rider claim (editable) │  case summary         │  case summary         │   per event, coloured by │
│  driver statement       │  arguments + chips    │  arguments + chips    │   actor; the Judge       │
│  [Resolve dispute]      │  counterevidence      │  counterevidence      │   handoff is a large     │
│ Status                  │  requested remedy     │  requested remedy     │   interchange marker)    │
│  state, elapsed s / 90 s│  missing facts        │  missing facts        │                          │
│  [Export case file]     ├─────────────────────────────────────────────── │                          │
│                         │ Judge: ruling · findings + chips · model-assessed confidence · reasoning      │
│                         │ To the rider | To the driver      Action card (completed only)               │
├─────────────────────────┴───────────────────────────────────────────────┴──────────────────────────┤
│ Evidence (columns: GPS | Chat | Payment | History) — each record: ID, summary, "retrieved by", facts │
│ Policy clauses retrieved (DEMONSTRATION POLICY)                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Behaviour

- Load fixtures on start. In stub mode there are 2 contract examples without claims; show "Claim appears when the run starts" instead of a textarea value.
- **Resolve dispute** posts `{fixtureId, riderClaim}` (send `riderClaim` only when the user changed it). Disabled while a run is active; double clicks start only one run.
- Poll every 1000 ms with `after` = highest sequence seen; merge events by `sequence` (dedupe, sort); keep the latest body for all other fields; stop on `completed`, `incomplete` or `failed`; stop on unmount or when a new run starts. After 5 consecutive network errors show **Connection lost** with **Keep waiting** and **Stop** buttons.
- Status states and what they show: idle; starting; running (elapsed seconds and the 90 s deadline); completed (ruling, action card); incomplete (missing evidence list and "No ruling or payment was issued; this case needs human review." — never an amount); failed (error code and message and **Run again**); contract mismatch (endpoint and first issue); connection lost.
- Failed, incomplete and contract-mismatch runs never show the action card or any amount, and never say "no action".
- Chips: every cited evidence or policy ID. A resolved chip (found in `retrievedEvidence` / `retrievedPolicies`) scrolls to and highlights its card. An unresolved chip uses the warning style with the tooltip "Not among the retrieved records".
- "Retrieved by": for each evidence record, which advocate's `evidence.retrieved` events contained its ID (rider, driver, or both).
- Chat text renders as plain text in quotation marks (React escapes it; never use `dangerouslySetInnerHTML`). A record tagged `instruction_like` gets a warning badge: "Instruction-like text, treated as evidence only".
- Labels: ruling `rider_favored` → "Rider's claim upheld", `driver_favored` → "Driver's position upheld", `incomplete` → "Incomplete". Remedies: `keep_charge` → "Keep the charge (no refund)", `refund_route_excess` → "Refund the excess-distance charge", `refund_no_show_fee` → "Refund the no-show fee". Confidence: "Model-assessed confidence 86%" with a bar. Event types get readable names (`judge.started` → "Handoff to the Judge").
- Action card: remedy label, `formatSgd(amountCents)`, recipient, recommendation text, and the note "Amount calculated by the server from the evidence, not by the model."
- **Export case file** downloads `fairtrip-<fixtureId>-<runId>.json` containing `{ exportedAt, apiMode, fixtureId, run }` where `run` has the merged events.

### 12.3 Design tokens (Singapore transit-line palette; one accent per actor)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#1B2430` | text |
| `--paper` | `#F6F8FA` | page background |
| `--panel` | `#FFFFFF` | panels |
| `--rule` | `#D5DCE3` | borders |
| `--rider` | `#005EC4` | rider (Downtown line blue) |
| `--driver` | `#009645` | driver (East-West line green) |
| `--judge` | `#9900AA` | Judge (North-East line purple) |
| `--system` | `#5B6770` | system events |
| `--warn` | `#D42E12` | failures, unresolved chips, instruction-like text |
| `--amber` | `#B86E00` | incomplete state, deadline nearing |

Type: headings `"Barlow Condensed", "Arial Narrow", sans-serif` (signage feel, loaded from Google Fonts with fallbacks); body `system-ui, sans-serif` at 16 px minimum; evidence IDs in chips `ui-monospace, Consolas, monospace`. Sentence case everywhere. Visible keyboard focus. No animation except a brief highlight when a chip scrolls to its card.
