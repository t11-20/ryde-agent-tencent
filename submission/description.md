# FairTrip: project description (DRAFT)

> Draft by Claude Code for the human to finalise. Every metric is a placeholder of the form `[[FROM SCORECARD: …]]`.
> Fill each one from a **real** `packages/eval` scorecard run against the live system, never from the fake-server
> demo. If a number was not measured, delete the sentence instead of estimating it.
>
> All data is **SYNTHETIC**. All rules are a **DEMONSTRATION POLICY**: synthetic rules chosen by the FairTrip team.
> They are **not Ryde policy**.

## Overview

FairTrip is a prototype for the case study *Ryde — Multi-Agent Autonomous Dispute Resolution System*. It resolves
ride-hailing disputes with three AI agents:

- a **Rider Advocate**
- a **Driver Advocate**
- a **Judge**

Each advocate decides for itself which evidence to retrieve: GPS and telemetry, chat and call logs, the fare, and party
history. Each then builds a cited case for its side. The Judge weighs both cases against a versioned DEMONSTRATION
POLICY and issues:

- a ruling
- a model-assessed confidence
- a recommended action
- separate plain-language explanations for the rider and the driver

The prototype covers two dispute categories: route deviation and driver-declared rider no-shows.

## Target users

- Ride-hailing customer-support and trust-and-safety teams who handle fare and no-show disputes.
- Riders and drivers, who receive a reasoned, evidence-cited explanation instead of a template reply.

## Scenarios

All scenarios are synthetic fixtures.

| Scenario | What happens |
|---|---|
| **Material detour (R1)** | The route was 33% longer than the reference route, the rider objected in chat, and there was no documented diversion. The detour-excess charge is refunded. |
| **Rider-requested route (R2)** | The rider asked for, and agreed to, a longer route. The charge is kept. |
| **Road closure (R3)** | A documented advisory and a navigation reroute explain the detour. The charge is kept. |
| **No-show, driver never arrived (N1)** | The driver never came within 150 m of the pickup. The no-show fee is refunded. |
| **No-show, driver waited and called (N2)** | The fee is kept. |
| **Early cancellation (N3)** | The driver cancelled before the five-minute wait. The fee is refunded. |
| **Robustness: missing GPS** | The case is marked incomplete and goes to human review, with no amount. |
| **Robustness: missing payment** | The case is marked incomplete and goes to human review, with no amount. |
| **Robustness: prompt injection** | Injected instructions inside chat are flagged as untrusted case material, and the outcome does not change. |
| **Fairness: swapped histories** | Swapping the party histories does not change the outcome. |

## Pain points

- Manual review is slow and inconsistent. Agents read raw GPS traces, chat logs and fare breakdowns by hand.
- Template responses don't explain *why*, so both parties feel unheard.
- Money calculations done by hand or by a language model are error-prone.

## Value proposition

- **Both sides argued.** Each party gets an advocate that independently gathers and cites evidence.
- **Transparent.** Every claim cites evidence IDs and policy clause IDs, and every agent step is visible on screen.
- **Exact money.** Amounts are integer SGD cents from deterministic, tested calculations. The model never computes money.
- **Safe failure.** Missing decisive evidence produces "incomplete: human review", never a guess.

## Business workflow

1. A dispute arrives with the rider's claim and the driver's statement.
2. Both advocates retrieve evidence through two tools that are bound to that dispute only. They cannot reach other trips.
3. Each advocate submits a cited case. The controller hands both cases to the Judge.
4. The Judge applies the DEMONSTRATION POLICY and issues a ruling and recommended action.
5. A validator checks every citation and recomputes the amount from the remedy basis.
6. The result, the full trace and a JSON export are shown to the operator. A human reviews incomplete or failed runs.

## Technical architecture

- **Evidence layer (`@fairtrip/evidence`).** Built in TypeScript with Zod schemas. It provides:
  - deterministic route, pickup, fare and remedy calculations: haversine distances rounded to whole metres, and half-up integer division for cents
  - a stable evidence catalogue
  - dispute-bound `get_evidence` / `get_policy` tools
- **Agent orchestration.** Lane A builds the model adapter, the tool loop, the Judge, the run controller, the Express API and validation. *[Lane A to complete: model, adapter and architecture diagram.]*
- **Web UI.** A React single screen showing the advocates, the timeline, evidence with clickable citations, the Judge's ruling and the action card.
- **Evaluation runner.** Replays 12 synthetic fixtures through the live API and scores status, remedy, exact amount, citation validity, trace completeness and reasoning-leak absence, with a release gate.

## Prompting approach

*[Lane A to complete.]* Points to cover:
- each advocate's role prompt and tool use
- the Judge's policy-application prompt
- JSON output validated with Zod, with one repair attempt
- evidence text treated as untrusted (GEN-3)
- no chain-of-thought exposed to users

## Measured prototype value

All figures come from the evaluation scorecard on the synthetic fixtures with the DEMONSTRATION POLICY.

- Fixtures resolved correctly: [[FROM SCORECARD: fixtures passing, e.g. x/y]]
- Exact monetary correctness: [[FROM SCORECARD: amountExact x/y]]
- Citation validity: [[FROM SCORECARD: citationsValid x/y]]
- Repeated-run consistency (R1 and N2 run 3 times each): [[FROM SCORECARD: consistency x/y]]
- Trace completeness: [[FROM SCORECARD: traceComplete x/y]]
- Median / max end-to-end latency: [[FROM SCORECARD: latency p50]] / [[FROM SCORECARD: latency max]]
- Model calls per dispute: [[FROM SCORECARD: modelCalls / runs, or delete if Not measured]]
- Release gate: [[FROM SCORECARD: PASSED/FAILED]]

Confidence values shown in the UI are **model-assessed**. They are not a measured accuracy.

## Expected impact (projected, not measured)

These are projections, not measurements. Any figure here must be labelled as an estimate with its assumptions.

- Faster first response on route and no-show disputes, because evidence gathering and drafting are automated. [[PROJECTION: assumption-based estimate, if any]]
- More consistent outcomes, because the same policy is applied the same way each time.
- Fewer complaints that a decision went unexplained, because each party gets a cited explanation.

## Limitations

- **Synthetic data only.** No real trips, riders, drivers or payments were used.
- **DEMONSTRATION POLICY only.** It is not Ryde policy. Real deployment needs Ryde's actual rules and legal review.
- **Two categories.** Only route deviation and no-show are covered.
- **Reference route.** The reference route is synthetic, not a routing-service result.
- **Heuristic chat tags.** Chat tags are keyword heuristics and only hints.
- **Model-assessed confidence.** Confidence is assessed by the model and is not calibrated.
- **Small evaluation.** The evaluation covers 12 fixtures. It is not a statistical accuracy claim.
- **Human review.** Incomplete and failed runs need human review by design.
