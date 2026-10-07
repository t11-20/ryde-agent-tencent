import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDataset, type Dataset } from "./dataset.js";

export * from "./index.js";

/** Package `data/` directory (works from both src/ and dist/). */
export const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "data");

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));

/** Loads and Zod-parses policy, fixtures and expected outcomes; rejects duplicate IDs. */
export function loadDataset(dataDir: string = DEFAULT_DATA_DIR): Dataset {
  const fixturesDir = join(dataDir, "fixtures");
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).sort();
  return parseDataset({
    policy: readJson(join(dataDir, "policy", "demo-policy.v1.json")),
    fixtures: files.map((f) => readJson(join(fixturesDir, f))),
    expectedOutcomes: (readJson(join(dataDir, "expected-outcomes.json")) as unknown[]) ?? [],
  });
}
