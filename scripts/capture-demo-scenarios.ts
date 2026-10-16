// Captures the server's replay mode (recorded live runs enriched with verdict,
// risk, escalation and precedents) into the glass UI's offline catalogue.
// Self-contained: starts an in-process API on API_PORT 3101; never touches the
// developer server on 3001 and never calls a model.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFixtureSource } from '@fairtrip/evidence';
import { createApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';

const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = fileURLToPath(new URL('../apps/web/src/glass/demo-scenarios.json', import.meta.url));

interface FixtureItem { id: string; label: string; category: 'route_deviation' | 'no_show' }
interface FixturesResponse { fixtures: FixtureItem[] }
interface RunResponse { id: string; status: string }

const config = readConfig({RUN_MODE: 'replay', API_PORT: String(PORT), REPLAY_SPEED: '50'});
const server = createApp(config, undefined, createFixtureSource()).listen(PORT, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', () => { resolve(); });
  server.once('error', reject);
});

try {
  const fixtures = await (await fetch(`${BASE}/api/fixtures`)).json() as FixturesResponse;
  const scenarios = [];
  for (const fixture of fixtures.fixtures) {
    const started = await fetch(`${BASE}/api/runs`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({fixtureId: fixture.id}),
    });
    if (!started.ok) throw new Error(`POST /api/runs ${fixture.id} returned HTTP ${started.status}`);
    const {id} = await started.json() as RunResponse;
    let run: unknown;
    for (let poll = 0; poll < 400; poll++) {
      const response = await fetch(`${BASE}/api/runs/${id}`);
      if (!response.ok) throw new Error(`GET /api/runs/${id} returned HTTP ${response.status}`);
      run = await response.json();
      if (['completed', 'incomplete', 'failed'].includes((run as RunResponse).status)) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!['completed', 'incomplete', 'failed'].includes((run as RunResponse).status))
      throw new Error(`Run ${id} for ${fixture.id} did not reach a terminal status`);
    scenarios.push({id: fixture.id, label: fixture.label, category: fixture.category, provenance: 'recorded-live', run});
    console.log(`${fixture.id}: ${(run as RunResponse).status}`);
  }
  const catalogue = {
    notice: 'SYNTHETIC DATA · DEMONSTRATION POLICY · 20 recorded case reviews; no live model calls',
    scenarios,
  };
  writeFileSync(OUT, `${JSON.stringify(catalogue, null, 2)}\n`);
  console.log(`Wrote ${scenarios.length} recorded case reviews to ${OUT}`);
} finally {
  await new Promise(resolve => { server.close(resolve); });
}
