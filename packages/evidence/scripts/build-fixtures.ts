/**
 * Generates data/fixtures/*.json and data/expected-outcomes.json (SYNTHETIC).
 *   npm run fixtures:build            write into data/
 *   npm run fixtures:check            regenerate into a temp dir and diff against the committed files
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDataset } from "../src/dataset.js";
import { buildExpectedOutcomes } from "./lib/expected.js";
import { buildAllFixtures } from "./lib/fixtures.js";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(pkgRoot, "data");
const json = (x: unknown): string => `${JSON.stringify(x, null, 2)}\n`;

function generate(outDir: string): void {
  const policy = JSON.parse(readFileSync(join(dataDir, "policy", "demo-policy.v1.json"), "utf8")) as unknown;
  const fixtures = buildAllFixtures();
  const dataset = parseDataset({ policy, fixtures, expectedOutcomes: [] });
  const expected = buildExpectedOutcomes(dataset);
  parseDataset({ policy, fixtures, expectedOutcomes: expected });
  const fxDir = join(outDir, "fixtures");
  rmSync(fxDir, { recursive: true, force: true });
  mkdirSync(fxDir, { recursive: true });
  for (const f of dataset.fixtures) writeFileSync(join(fxDir, `${f.fixtureId}.json`), json(f));
  writeFileSync(join(outDir, "expected-outcomes.json"), json(expected));
}

function listFiles(dir: string): string[] {
  return [
    "expected-outcomes.json",
    ...readdirSync(join(dir, "fixtures")).filter((f) => f.endsWith(".json")).sort().map((f) => `fixtures/${f}`),
  ];
}

if (process.argv.includes("--check")) {
  const tmp = mkdtempSync(join(tmpdir(), "fairtrip-fixtures-"));
  try {
    generate(tmp);
    const want = listFiles(tmp);
    const have = listFiles(dataDir);
    const problems: string[] = [];
    for (const f of new Set([...want, ...have])) {
      if (!want.includes(f)) problems.push(`unexpected committed file: data/${f}`);
      else if (!have.includes(f)) problems.push(`missing committed file: data/${f}`);
      else if (readFileSync(join(tmp, f), "utf8") !== readFileSync(join(dataDir, f), "utf8")) problems.push(`differs from generator: data/${f}`);
    }
    if (problems.length) {
      console.error(`fixtures:check FAILED\n- ${problems.join("\n- ")}\nRun npm run fixtures:build (never hand-edit generated JSON).`);
      process.exit(1);
    }
    console.log(`fixtures:check passed (${want.length} files match the generator).`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
} else {
  generate(dataDir);
  console.log(`Wrote ${listFiles(dataDir).length} files to ${dataDir}.`);
}
