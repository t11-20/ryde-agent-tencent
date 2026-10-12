# SPEC §3. Repository layout after Lane B

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

```
CODEBUDDY.md  AGENTS.md  .codebuddy/          agent rules and slash commands
harness/                                      this harness (only STATUS.md changes during work)
vitest.config.ts                              NEW (LB-01): root test file patterns
packages/
  contracts/   agents/                        Lane A (agents gains DisputeSource in LB-08, extractJsonText in LB-11)
  evidence/                                   NEW Lane B
    package.json  tsconfig.build.json
    data/policy.json  data/expected-outcomes.json  data/fixtures/*.json   (copied from harness/data, never edited)
    src/index.ts  src/data-dir.ts  src/schemas.ts  src/dataset.ts
    src/geo.ts  src/money.ts  src/time.ts  src/route.ts  src/pickup.ts
    src/chat.ts  src/fare.ts  src/remedy.ts  src/facts.ts  src/build-evidence.ts  src/policy.ts  src/source.ts
    test/*.test.ts
  eval/                                       NEW Lane B (LB-14)
    package.json  .gitignore  src/index.ts  src/cli.ts  src/client.ts  src/checks.ts  src/scorecard.ts  src/gate.ts  test/*.test.ts
apps/
  api/                                        Lane A (small wiring edits in LB-09 and LB-11)
  web/                                        Lane B UI (LB-12, LB-13); replaces the placeholder package.json and README
tests/
  integration/                                NEW: scripted-model.ts, api-source.test.ts, golden-flow.test.ts, model-hardening.test.ts, eval-e2e.test.ts
submission/                                   NEW (LB-16): identity, description, metrics, presentation outline, cover
docs/evidence/                                CodeBuddy screenshots and captions
```
