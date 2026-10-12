# FairTrip — project description

Labels: all dispute data is SYNTHETIC DATA; the rules applied are a DEMONSTRATION POLICY, not Ryde policy; confidence values are model-assessed confidence; the comparison path in route disputes is a reference route.

## Project overview

FairTrip is a multi-agent autonomous dispute-resolution prototype for ride-hailing.

- **Target scenarios:** route-deviation disputes ("the driver took a longer route and I was overcharged") and no-show charge disputes ("the driver didn't show up but I was charged a cancellation fee"). Both categories work end-to-end, from filing to ruling, recommended action and explanations.
- **Users:** riders who file disputes, drivers who answer them, and support operations who watch the process, export case files and take over the cases the system marks for human review.
- **Value proposition:** fast, evidence-backed, policy-grounded decisions that are explained to both parties. Evidence is gathered by the agents themselves, every argument cites retrieved records, money is calculated deterministically by the server (never by the model), and each run is fully observable in the UI.

## Real-world scenario insights

- **Source of pain points:** the Ryde challenge statement of the Tencent Cloud AI Singapore Hackathon 2026 (archived in `harness/reference/requirements.md`) describes disputes that are complex, subjective and emotionally charged, requiring human agents to manually review GPS telemetry, chat logs, payment records and company policy. The challenge statement reports resolution times of typically 24–72 hours per dispute, inconsistent rulings between agents, millions spent annually on human support hours, and churn among customers who feel unfairly treated. These figures are the challenge statement's industry context; they are not FairTrip measurements.
- **Target audience:** ride-hailing platforms' support operations, and the riders and drivers whose disputes they handle.
- **Core problems solved:** (1) manual, slow evidence review — the advocates autonomously request and analyse GPS, chat, payment and history records through tools; (2) inconsistent rulings — cases are built against cited policy clauses and checked server-side, and money comes from deterministic formulas; (3) opaque decisions — the whole inter-agent exchange (tool requests, retrieved records, cases, Judge reasoning) is visible in the UI and exportable; (4) unsafe guessing — when decisive evidence is missing the run ends `incomplete` and asks for human review instead of inventing an amount.

## Comprehensive solution design

- **Business architecture:** submit → gather evidence → advocate → adjudicate → recommend action → explain to both parties. A dispute is filed in the UI; the Rider Advocate and Driver Advocate independently gather evidence and build cited cases; the Judge weighs both cases against policy and selects a remedy; the server turns that remedy into a monetary action; both parties receive a plain-language explanation plus the ruling, confidence and reasoning.
- **Technical architecture:** three LLM agents (Rider Advocate, Driver Advocate, Judge) in `@fairtrip/agents`, orchestrated by an Express API (`apps/api`). The evidence layer `@fairtrip/evidence` provides geo/money/time helpers, GPS/chat/fare metrics, the evidence builder and the synthetic fixture set with the DEMONSTRATION POLICY (`packages/evidence/data`). A single seam, `DisputeSource`, plugs Lane B fixtures, evidence, policy and calculations into the Lane A API; in stub mode the seam is ignored and Lane A's labelled contract examples are served. Money is integer SGD cents computed server-side with half-up division: the Judge only selects a remedy ID. A decisive-evidence guard ends a run `incomplete` when GPS or payment data is unavailable, whatever the Judge said. The single-screen React UI (`apps/web`) makes every event observable and exports case files. The evaluation runner (`packages/eval`) replays fixtures against the live API, checks status/remedy/amount, citations and trace completeness, enforces a release gate and writes a scorecard.
- **How prompts drive the AI generation:** each agent gets a role prompt (rider's representative, driver's representative, impartial arbitrator). Advocates follow a tool-request protocol: they reply JSON-only, either a `tool_request` for `get_evidence`/`get_policy` (at most two rounds) or a `final_case`; citations must reference retrieved evidence and policy IDs and are validated against each advocate's own retrieval scope. The Judge prompt permits only remedy IDs, never amounts, so monetary values can never be hallucinated. An untrusted-evidence rule keeps chat text as evidence only: instruction-like messages are badged in the UI and never obeyed by the agents. Invalid JSON or schema output gets exactly one repair attempt before the run fails safely.

## Business value

Measured prototype results, live model MiniMax-M3, release-gate run `20261012-155433` on 2026-10-12, copied from `submission/metrics/scorecard.md`:

- Runs passed: 15 / 15
- Fixtures passed: 11 / 11
- Exact money: 15 / 15
- Citation validity: 15 / 15
- Trace completeness: 15 / 15
- Consistency: 2 / 2 repeated fixtures
- p50 latency: 17.2 s; max latency: 24.3 s
- Token usage: not measured (the API does not report it)
- Release gate: PASS (all five named conditions)

Expected impact (projected, not measured): standard route-deviation and no-show cases handled in minutes instead of the multi-day turnaround described in the challenge statement, less manual review effort per ticket, more consistent rulings across similar cases, and clearer explanations for both parties. These are projections from a prototype measured on synthetic data; they are not production performance claims.

## Limitations

- All dispute data is SYNTHETIC DATA; no real riders, drivers or trips are involved.
- The rules applied are a DEMONSTRATION POLICY, not Ryde policy.
- Runs are stored in memory; there is no persistence or database.
- There is no authentication or authorisation; the prototype is a local demo on `127.0.0.1`.
- Confidence values are model-assessed confidence, not accuracy or certainty.
- Results were measured once against the live model on the scorecard date; other runs may differ.
