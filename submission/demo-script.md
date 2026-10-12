# FairTrip — seven-minute demonstration script

Adapted from `Ryde_Two_Lane_Execution_Plan.md` §14. Live mode with the real model; fixtures preloaded; UI at `http://127.0.0.1:5173` with the API at `http://127.0.0.1:3001`. Expected outcomes: R1 → refund S$1.98; N2 → keep the charge; X1 → incomplete.

| Time | Content | Operator clicks | Narrator points at | Presenter |
|---|---|---|---|---|
| 0:00–0:35 | Name the case study (exact line: "Ryde — Multi-Agent Autonomous Dispute Resolution System"), users and problem. | Open slide 1; nothing else. | The case-study line and the SYNTHETIC DATA / DEMONSTRATION POLICY badges. | Lane A |
| 0:35–1:10 | Explain the architecture and the three distinct agent roles. | Open the architecture slide (SPEC §1 diagram). | The `DisputeSource` seam and the "server computes money" arrow. | Lane A |
| 1:10–3:10 | Run R1: evidence gathering, advocacy, Judge ruling, partial refund S$1.98. | In the UI: select fixture R1, leave the claim, click **Resolve dispute**; when completed click **Export case file**. | Tool requests and retrieved chips in both advocate columns; the Judge interchange marker on the timeline; ruling "Rider's claim upheld"; action card refund S$1.98 and the note "Amount calculated by the server from the evidence, not by the model." | Lane B operates; Lane A narrates |
| 3:10–4:40 | Run N2: a supported outcome favorable to the driver — keep the charge. | Select fixture N2, click **Resolve dispute**. | Driver advocate's cited evidence and policy chips; ruling "Driver's position upheld"; remedy "Keep the charge (no refund)"; explanations to both parties. | Lane B |
| 4:40–5:20 | Demonstrate safe failure: X1 (missing GPS) ends incomplete. | Select fixture X1, click **Resolve dispute**. | The missing-evidence list, the amber `incomplete` state, "No ruling or payment was issued; this case needs human review." and the absence of any amount or action card. | Lane A |
| 5:20–6:10 | Present measured prototype results and limitations. | Open the scorecard slide (`submission/metrics/scorecard.md`). | 15/15 runs, 11/11 fixtures, exact money 15/15, citations 15/15, traces 15/15, consistency 2/2, p50 17.2 s, max 24.3 s; then the limitations list. | Lane B |
| 6:10–7:00 | Explain the build approach, CodeBuddy usage and a practical development lesson. | Open the build-approach slide; show `docs/evidence/` captions. | The task-card workflow, the golden-value tests, and the development-chat screenshots. | Both |

Optional add-on if time allows: run X2 and show the instruction-like chat message badged "Instruction-like text, treated as evidence only" — the injection is ignored and the ruling follows the evidence.

## Backup plan

- Exported traces: every demo run can be saved with **Export case file** (`fairtrip-<fixtureId>-<runId>.json`); keep the R1, N2 and X1 exports from the rehearsal on the demo laptop.
- Recorded walkthrough: a screen recording of the same seven minutes, kept beside the slides. If it is used during a service outage, the presenter states on stage that the material is **recorded**, and the recording carries an on-screen "RECORDED" label.
- If the model endpoint is unreachable, do not switch to stub mode on stage without saying so: stub output is labelled STUB and is not a live adjudication.
