# FairTrip — project description

**Case study:** Ryde — Multi-Agent Autonomous Dispute Resolution System (Tencent Cloud AI Singapore Hackathon 2026, Digital Native Track). **Built with:** CodeBuddy desktop (see "Development with CodeBuddy" below).

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
- **Technical architecture:** four LLM agents in `@fairtrip/agents` — the three core agents (Rider Advocate, Driver Advocate, Judge) and the Risk Analyst stretch agent — orchestrated by an Express API (`apps/api`). The evidence layer `@fairtrip/evidence` provides geo/money/time helpers, GPS/chat/fare metrics, the evidence builder and the synthetic fixture set with the DEMONSTRATION POLICY (`packages/evidence/data`). A single seam, `DisputeSource`, plugs Lane B fixtures, evidence, policy and calculations into the Lane A API; in stub mode the seam is ignored and Lane A's labelled contract examples are served. Money is integer SGD cents computed server-side with half-up division: the Judge only selects a remedy ID. A decisive-evidence guard ends a run `incomplete` when GPS or payment data is unavailable, whatever the Judge said. The single-screen React UI (`apps/web`) makes every event observable and exports case files. The evaluation runner (`packages/eval`) replays fixtures against the live API, checks status/remedy/amount, citations and trace completeness, enforces a release gate and writes a scorecard.
- **How prompts drive the AI generation:** each agent gets a role prompt (rider's representative, driver's representative, impartial arbitrator). Advocates follow a tool-request protocol: they reply JSON-only, either a `tool_request` for `get_evidence`/`get_policy` (at most two rounds) or a `final_case`; citations must reference retrieved evidence and policy IDs and are validated against each advocate's own retrieval scope. The Judge prompt permits only remedy IDs, never amounts, so monetary values can never be hallucinated. An untrusted-evidence rule keeps chat text as evidence only: instruction-like messages are badged in the UI and never obeyed by the agents. The Risk Analyst prompt asks the model for the summary text only — the signals it describes are computed by the server — and Judge context rules tell the Judge that risk and precedents are for consistency only and may never override the case's evidence. Invalid JSON, schema or citation output gets at most two repair attempts (one shared budget per agent) before the run fails safely.
- **Deterministic policy verdict and finalisation:** no payment can be finalised against the demonstration policy, by construction. The evidence layer computes a `PolicyVerdict` from the case features before the agents start, and the server finalises a completed run only when the Judge's remedy equals that verdict; a Judge that disagrees — or a case the rules cannot determine — completes as an escalated recommendation with a divergence record, and a reviewer can apply the policy verdict with one click (the amount is rebuilt server-side). The model still writes the arguments, the explanations and the confidence; it never produces the verdict, the money, or the status when decisive evidence is missing. Any first-attempt workflow failure except an internal invariant violation gets exactly one automatic re-run; both attempts stay visible and a re-run can never pay twice.

## Development with CodeBuddy

The project was built in CodeBuddy desktop. Lane B was developed as a sequence of task cards (`harness/tasks/LB-00` to `LB-16`), each run as one CodeBuddy chat against this repository: the agent read the card and the specification, implemented the files the card allowed, ran the verification commands and reported the results. Seven development-chat captures with captions are in `docs/evidence/README.md` (setup and baseline, GPS golden-value tests, API integration, live UI run, live release-gate evaluation and a MiniMax request-shape debugging session). Custom CodeBuddy commands and rules used during development are in `.codebuddy/`.

## Stretch goals implemented

- **Fraud & Bad-Faith Detection Agent (Risk Analyst).** A fourth agent runs in parallel with the advocates and surfaces risk signals derived from the dispute's history and chat records (frequent filers, repeat complaint subjects, low ratings, instruction-like or threatening chat), each cited to the evidence that produced it. What it may NOT do: it never produces or removes a signal — the server computes the signal set deterministically and the model only writes the summary — and it never establishes fault; every assessment carries the caveat that risk is context only. The demo shows it on fixture N2H, where driver-side signals raise the assessment to high on the Risk Analyst lane and panel while the ruling itself still follows the evidence.
- **Escalation Protocol.** A completed live run escalates for human review when the model-assessed confidence falls below a configured threshold or the risk assessment is high. The status stays `completed` but the ruling and amount become recommendations: the bench switches to a human-review state with Confirm and Override controls, and an override rebuilds the monetary action with the same server formulas — a reviewer can change the remedy but never type an amount. What it may NOT do: escalation never changes the computed outcome by itself; only a human review decision recorded via `POST /api/runs/:id/review` does. The demo shows the N2H bench read "Sent to human review" and an override to a no-show fee refund.
- **Policy & Precedent Agent with Learning Feedback Loop.** Each run is summarised into case features and matched against a precedent store — a synthetic seed plus rulings written back from completed runs and human overrides — so the Judge sees how similar past cases were decided. What it may NOT do: precedents are for consistency only and can never override this case's evidence, and they never change the status, remedy or amount; the release gate enforces that in code. The demo shows the matched precedents listed in the Judge column, and the reviewer's override appearing in a later run's "Precedents considered".

## Business value

Measured prototype results, live model MiniMax-M3, release-gate run `20261013-144417` on 2026-10-13 against contract 0.3.0, copied from `submission/metrics/scorecard.md`:

- Runs passed: 27 / 27 (26 planned runs plus one human-review feedback probe)
- Fixtures passed: 20 / 20
- Exact money: 27 / 27
- Citation validity: 27 / 27
- Trace completeness: 27 / 27
- Risk signals intact: 27 / 27
- Escalated runs: 7, outcome unchanged in all 7 — R1F #1–#3 (refund_route_excess 198), N1R #1 (refund_no_show_fee 500), N2H #1, X2 #1 and X6 #1 (keep_charge 0)
- Human-review feedback probe: pass (X2 confirmed with its action unchanged; N2H overridden to refund_no_show_fee 500 = the server-computed eligible amount; the follow-up N2 run saw the new `human_override` precedent and still ruled keep_charge)
- Consistency: 3 / 3 repeated fixtures (R1, N2, R1F)
- p50 latency: 16.1 s; max latency: 19.2 s
- Token usage: not measured (the API does not report it)
- Release gate: PASS (all seven named conditions)

In the seven escalated runs the flagged party's side still won on the evidence in six (R1F ×3, N1R, N2H, X6) and lost in one (X2 — the flagged rider's instruction-like chat never overrode the trip evidence); escalation changed no outcome either way. The feedback probe demonstrates the learning loop end-to-end: a synthetic human override of N2H became the most recent precedent and was surfaced to the next N2 run as consistency context without altering its ruling.

Expected impact (projected, not measured): standard route-deviation and no-show cases handled in minutes instead of the multi-day turnaround described in the challenge statement, less manual review effort per ticket, more consistent rulings across similar cases, and clearer explanations for both parties. These are projections from a prototype measured on synthetic data; they are not production performance claims.

## Limitations

- All dispute data is SYNTHETIC DATA; no real riders, drivers or trips are involved.
- The rules applied are a DEMONSTRATION POLICY, not Ryde policy.
- Runs are stored in memory; there is no persistence or database.
- There is no authentication or authorisation; the prototype is a local demo on `127.0.0.1`.
- Confidence values are model-assessed confidence, not accuracy or certainty.
- Risk thresholds are demonstration heuristics (`RISK_PARAMS`), not Ryde rules.
- The consent/objection features behind the policy verdict are keyword heuristics over synthetic chat text; when they conflict the verdict is "undetermined" and the case goes to a human rather than guessing.
- The precedent store is in-memory plus a synthetic seed file; it resets on restart.
- Human review is a UI action with no authentication or reviewer identity.
- There is no per-dispute idempotency: repeat POSTs produce independent rulings. Payments are recommendations, so a real execution layer must dedupe on dispute id.
- Results were measured once against the live model on the scorecard date; other runs may differ.
