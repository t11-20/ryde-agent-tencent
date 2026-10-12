# SPEC §10. Scripted model (test double, tests only)

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

`tests/integration/scripted-model.ts` exports `createScriptedModel(): ModelAdapter & { calls: { rider: number; driver: number; judge: number } }`. It is never used by the server. It lets tests drive the real workflow, tools, evidence and money without a network.

- Role: the first message's content starts with `You are the Rider Advocate`, `You are the Driver Advocate` or `You are the Judge`.
- Dispute: the system prompt line `DISPUTE ID: <id>`; find the fixture with that `dispute.id` and its expected outcome via `loadDataset()`.
- Advocate, first call (no user message starts with `Evidence retrieval results:`): return
  `{"type":"tool_request","tools":[{"name":"get_evidence","input":{"sources":["gps","chat","payment","history"]}},{"name":"get_policy","input":{"category":"<category>"}}]}`.
- Advocate, later call: parse the JSON after the first newline of the `Evidence retrieval results:` and `Policy retrieval results:` messages. Return a `final_case` for its side citing the first retrieved evidence ID and the first retrieved policy ID; `requestedRemedyId`: rider → `refund_route_excess` (route) or `refund_no_show_fee` (no-show); driver → `keep_charge`; `counterevidence: []`; `missingFacts: []`.
- Judge: parse `messages[1].content` (JSON with `evidence` and `policies`). Return `ruling` = expected ruling or `'incomplete'` when null; `remedyId` = expected remedy or `'keep_charge'` when null; one finding citing the expected `decisiveEvidenceIds` and `keyClauseIds` **that appear in the provided context** (filter the rest out); `confidence 0.9`; short `reasoning`, `riderExplanation`, `driverExplanation` saying this is a scripted test double.
