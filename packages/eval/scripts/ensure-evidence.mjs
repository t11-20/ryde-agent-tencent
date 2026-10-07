// Builds @fairtrip/evidence when its dist/ is missing (clean clone). Standalone mode: no root workspace.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evidence = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "evidence");
if (!existsSync(resolve(evidence, "dist", "index.js"))) {
  console.log("[ensure-evidence] building @fairtrip/evidence ...");
  if (!existsSync(resolve(evidence, "node_modules"))) execSync("npm ci --no-audit --no-fund", { cwd: evidence, stdio: "inherit" });
  execSync("npm run build", { cwd: evidence, stdio: "inherit" });
}
