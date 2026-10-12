# FairTrip — presentation outline (10 slides, one line each)

1. **Title:** Ryde — Multi-Agent Autonomous Dispute Resolution System · FairTrip · "Three agents resolve ride disputes with transparent evidence." · badges: SYNTHETIC DATA, DEMONSTRATION POLICY.
2. **Problem and users:** manual review of GPS, chat and payment records with 24–72 hour resolutions and inconsistent rulings (challenge-statement figures, not ours) hurts riders, drivers and support operations.
3. **Architecture diagram:** fixtures and demonstration policy → `@fairtrip/evidence` calculations → `DisputeSource` seam → Express API → three agents → server-side money, with the observable UI and the evaluation runner on the side (SPEC §1 diagram).
4. **Agents and tools:** Rider Advocate and Driver Advocate request `get_evidence`/`get_policy` through a JSON tool protocol and cite only retrieved records; the Judge selects a remedy ID only — the server computes the amount.
5. **Live demo R1 (route deviation):** watch tool requests, retrieved chips and the Judge handoff on the transit-line timeline; ruling "Rider's claim upheld", server-computed refund S$1.98.
6. **Live demo N2 (no-show):** the driver's position is upheld on the evidence — remedy `keep_charge`, the charge stands, both parties still get explanations.
7. **Safety behaviour:** X1 (missing GPS) ends `incomplete` with no amount and a human-review note; X2 (prompt injection in chat) is treated as evidence only and ignored as an instruction.
8. **Measured results:** 15/15 runs and 11/11 fixtures passed, exact money 15/15, citation validity 15/15, trace completeness 15/15, consistency 2/2, p50 17.2 s, max 24.3 s (MiniMax-M3, 2026-10-12 scorecard); token usage not measured.
9. **How we built it with CodeBuddy and one practical lesson:** task cards with golden-value tests kept every calculation honest; lesson — showing the exact object shape in prompts (counterevidence items) removed a whole class of schema-repair failures.
10. **Limitations and next steps:** synthetic data, demonstration policy, in-memory runs, no authentication, local demo; next: persistence, human-escalation workflow, real policy text and hosted demo.
