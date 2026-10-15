# Replay recordings

`20261013-144417/` holds the raw attempt-1 eval records (`runs/<FIXTURE>-1.json`) from the passing live release gate of 2026-10-13 (eval run `20261013-144417`, model `MiniMax-M3`, contract 0.3.0). Each file is `{fixtureId, attempt, runId, latencyMs, timedOut, problem, run}` exactly as `packages/eval` wrote it.

The 20 fixtures are synthetic, team-authored Lane B data and the applied rules are a DEMONSTRATION POLICY — no real riders, drivers, trips or policy.

`RUN_MODE=replay` serves these records without calling a model: the API schedules each recorded event at its original offset divided by `REPLAY_SPEED` and rebuilds the run (evidence, policy, calculations, precedents and the review endpoint stay real server behaviour).

## Refreshing after a new passing gate

```sh
mkdir -p apps/api/replays/<new-run-id>
for f in packages/eval/results/<new-run-id>/runs/*-1.json; do cp "$f" apps/api/replays/<new-run-id>/; done
```

One file per fixture — never the `-2`/`-3` consistency attempts and never the `N2-*-feedback.json` probe. Then point `REPLAY_DIR` at the new folder (default is `apps/api/replays/20261013-144417`, resolved relative to the repository root).

Replay mode never calls a model; `MODEL_*` variables are not required.
