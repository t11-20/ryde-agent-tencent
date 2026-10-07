/**
 * Writes docs/lane-b/contracts/: JSON Schemas of the API responses the UI and eval expect, plus
 * ILLUSTRATIVE example responses built from the real SYNTHETIC fixtures and evidence computations.
 *   npm run contracts:build          write
 *   npm run contracts:build -- --check   fail if the committed files differ
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { findFixture } from "@fairtrip/evidence";
import { CreateRunResponseSchema, FixtureListSchema, RunViewSchema } from "../src/contracts/provisional";
import { loadDataset } from "@fairtrip/evidence/node";
import { buildScenario, DEV, viewAt, type ScenarioId } from "../src/mock/scenarios";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "lane-b", "contracts");
const files = new Map<string, string>();
const put = (name: string, x: unknown) => files.set(name, `${JSON.stringify(x, null, 2)}\n`);
const schema = (s: z.ZodType, title: string) => ({ title, ...(z.toJSONSchema(s, { io: "input", unrepresentable: "any" }) as object) });

put("fixtures.schema.json", schema(FixtureListSchema, "GET /api/fixtures response (PROVISIONAL)"));
put("create-run-response.schema.json", schema(CreateRunResponseSchema, "POST /api/runs response (PROVISIONAL)"));
put("run-view.schema.json", schema(RunViewSchema, "GET /api/runs/:id response (PROVISIONAL)"));

const ds = loadDataset();
const START = Date.UTC(2026, 9, 7, 9, 0, 0);
const NOTE =
  "ILLUSTRATIVE contract example. Evidence records, policy clauses and amounts are real computations from @fairtrip/evidence; " +
  "advocate cases, Judge text and event timing are SCRIPTED placeholders, not agent output. A live server must not set `dev`.";

const strip = (s: string) => s.replace(`${DEV} `, "");
function example(fixtureId: string, scenario: ScenarioId, name: string): void {
  const fixture = findFixture(ds, fixtureId);
  if (!fixture) throw new Error(fixtureId);
  const steps = buildScenario(ds, fixture, scenario);
  if (!steps) throw new Error(`${fixtureId}/${scenario}`);
  const v = RunViewSchema.parse(viewAt(`run-${fixtureId.toLowerCase()}-example`, START, { dispute: fixture.dispute }, steps, 60_000, 0));
  const json = JSON.parse(JSON.stringify(v), (k, val: unknown) => (k === "dev" ? undefined : typeof val === "string" ? strip(val) : val)) as unknown;
  put(`examples/${name}.json`, { _note: NOTE, response: json });
}
example("R1", "completed", "run-view.R1.completed");
example("N2", "completed", "run-view.N2.completed");
example("X1", "incomplete", "run-view.X1.incomplete");
example("R1", "provider_timeout", "run-view.R1.failed-timeout");
example("R1", "unknown_citation", "run-view.R1.failed-unknown-citation");

if (process.argv.includes("--check")) {
  const bad = [...files].filter(([n, c]) => !existsSync(join(out, n)) || readFileSync(join(out, n), "utf8") !== c).map(([n]) => n);
  if (bad.length) { console.error(`contracts:check FAILED, stale: ${bad.join(", ")}. Run npm run contracts:build.`); process.exit(1); }
  console.log(`contracts:check passed (${files.size} files).`);
} else {
  mkdirSync(join(out, "examples"), { recursive: true });
  for (const [n, c] of files) writeFileSync(join(out, n), c);
  console.log(`Wrote ${files.size} files to ${out}.`);
}
