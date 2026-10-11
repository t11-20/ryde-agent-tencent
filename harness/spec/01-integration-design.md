# SPEC §1. Integration design

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

Lane A already runs the three agents. Its advocates call two tools (`get_evidence`, `get_policy`) through an `EvidenceTools` interface, and its server turns the Judge's chosen remedy into money through a `CalculationProvider` interface. Today both are filled by Lane A's mock data. Lane B supplies real implementations through one new seam, `DisputeSource`, which `createApp` receives as an optional third argument. Lane A's 67 existing tests do not pass a source, so they keep testing the mock path unchanged.

```mermaid
flowchart LR
  subgraph LaneB["Lane B (you build)"]
    DATA[("packages/evidence/data<br/>fixtures, policy, expected outcomes")]
    EVID["@fairtrip/evidence<br/>calculations + evidence builder"]
    SRC["createFixtureSource()<br/>DisputeSource"]
    WEB["apps/web<br/>React UI"]
    EVAL["packages/eval<br/>evaluation runner"]
  end
  subgraph LaneA["Lane A (exists)"]
    API["apps/api Express<br/>createApp(config, model, source)"]
    WF["@fairtrip/agents<br/>Rider Advocate, Driver Advocate, Judge"]
    REM["buildFinalAction<br/>server-side money"]
  end
  DATA --> EVID --> SRC --> API
  API --> WF
  WF -- "get_evidence / get_policy" --> SRC
  WF --> REM
  SRC -- "CalculationProvider" --> REM
  WEB -- "HTTP poll /api" --> API
  EVAL -- "HTTP /api" --> API
  EVAL -. "expected outcomes" .-> DATA
```

Rules of the seam:

- `RUN_MODE=stub`: Lane A's fixed contract examples, exactly as today. The source is ignored.
- `RUN_MODE=live`: the server uses `createFixtureSource()`. Fixtures, evidence, policy and money all come from Lane B.
- The Judge never produces money. It selects a remedy ID; Lane A's `buildFinalAction` asks Lane B's `CalculationProvider` for the amount.
- A deterministic guard marks a run `incomplete` when decisive evidence (GPS or payment) is unavailable, whatever the Judge said.
