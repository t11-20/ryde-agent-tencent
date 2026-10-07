/** Writes examples/*.json for Lane A (generated from the SYNTHETIC fixtures; never hand-edit). */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDataset } from "../src/node.js";
import { createDisputeTools, getRemedyBasis, listFixtures } from "../src/tools.js";

const out = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "examples");
mkdirSync(out, { recursive: true });
const ds = loadDataset();
const ALL = ["gps", "chat", "payment", "history"];
const write = (name: string, x: unknown): void => writeFileSync(join(out, name), `${JSON.stringify(x, null, 2)}\n`);

write("get_evidence.R1.all.json", createDisputeTools(ds, "DSP-R1").get_evidence({ sources: ALL }));
write("get_evidence.N2.all.json", createDisputeTools(ds, "DSP-N2").get_evidence({ sources: ALL }));
write("get_evidence.X1.gps.json", createDisputeTools(ds, "DSP-X1").get_evidence({ sources: ["gps"] }));
write("get_policy.route_deviation.json", createDisputeTools(ds, "DSP-R1").get_policy({ category: "route_deviation" }));
write("get_policy.no_show.json", createDisputeTools(ds, "DSP-N2").get_policy({ category: "no_show" }));
write("tool_error.invalid_source.json", createDisputeTools(ds, "DSP-R1").get_evidence({ sources: ["bank"] }));
write("remedy_basis.R1.json", getRemedyBasis(ds, "DSP-R1"));
write("fixtures_list.json", listFixtures(ds));
console.log(`Wrote 8 examples to ${out}.`);
