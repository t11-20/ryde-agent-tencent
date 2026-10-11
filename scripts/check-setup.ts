import { readFileSync, existsSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {engines: {node: string; npm: string}};
const actualNpm = process.env.npm_config_user_agent?.match(/^npm\/([^ ]+)/)?.[1];
const failures: string[] = [];
if (process.versions.node !== pkg.engines.node) failures.push(`Node must be ${pkg.engines.node}; found ${process.versions.node}`);
if (actualNpm !== pkg.engines.npm) failures.push(`Run with npm ${pkg.engines.npm}; found ${actualNpm ?? 'unknown'}`);
for (const file of ['package-lock.json', '.env.example', '.gitignore']) if (!existsSync(file)) failures.push(`Missing ${file}`);
if (failures.length) {console.error(failures.join('\n')); process.exitCode = 1;} else {
  console.log(`Local foundation verified: Node ${process.versions.node}, npm ${actualNpm}, required setup files present.`);
  console.log('External gates remain separate: Buddy access/screenshots, partner verification, shared-contract review, model connectivity. See docs/READINESS.md.');
}
