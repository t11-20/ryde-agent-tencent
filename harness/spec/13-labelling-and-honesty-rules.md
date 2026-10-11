# SPEC §13. Labelling and honesty rules

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

- Show "DEMONSTRATION POLICY" and "SYNTHETIC DATA" on every screen and in exports. Never call the policy Ryde policy or the data real.
- Say "reference route", never "optimal route" or "fastest route".
- Say "model-assessed confidence", never "accuracy" or "certainty".
- Stub-mode output is labelled STUB; scripted-model output exists only in tests.
- Never display model reasoning beyond the public `reasoning` field; never display `<think>` content.
- Present measured numbers only from a real scorecard; present business impact as projected.
