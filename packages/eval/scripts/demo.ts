/**
 * npm run eval:demo — runs the real CLI pipeline against the in-process FAKE API server
 * (test/fakeServer.ts) and writes a scorecard to results/. The scorecard is labelled as a
 * fake-server demo: its numbers say nothing about the real agents.
 */
import { loadDataset } from "@fairtrip/evidence/node";
import { runEval } from "../src/cli.js";
import { startFakeServer } from "../test/fakeServer.js";

const srv = await startFakeServer(loadDataset());
try {
  const { scorecard } = await runEval({
    baseUrl: srv.url, fixtures: "release", repeat: 1, timeoutSec: 10, delayMs: 0, pollMs: 20, concurrency: 1,
    out: "results", releaseGate: true, label: "FAKE SERVER DEMO: scripted responses, not real agent results. Do not quote these numbers.",
  });
  if (!scorecard.releaseGate?.passed) process.exitCode = 2;
} finally {
  await srv.close();
}
