// Usage: npx tsx scripts/live-smoke.ts R1   (the API must already be running)
import { RunSchema } from '@fairtrip/contracts';
const fixtureId = process.argv[2] ?? 'R1';
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3001';
const started = await fetch(`${base}/api/runs`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({fixtureId})});
if (!started.ok) { console.error(`POST /api/runs failed: HTTP ${started.status}`); process.exit(1); }
const {id} = await started.json() as {id: string};
const seen = new Set<number>();
for (let attempt = 0; attempt < 100; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const run = RunSchema.parse(await (await fetch(`${base}/api/runs/${id}?after=0`)).json());
  for (const event of run.events) if (!seen.has(event.sequence)) { seen.add(event.sequence); console.log(`#${event.sequence} ${event.actor} ${event.type}: ${event.summary}`); }
  if (run.status === 'completed') { console.log(`RESULT completed: ${run.result.remedyId}, ${run.result.action.amountCents} cents, ruling ${run.result.ruling}, confidence ${run.result.confidence}`); process.exit(0); }
  if (run.status === 'incomplete') { console.log(`RESULT incomplete: ${run.missingEvidence.join(' | ')}`); process.exit(0); }
  if (run.status === 'failed') { console.log(`RESULT failed: ${run.error.code} ${run.error.message}`); process.exit(1); }
}
console.log('RESULT timeout after 100 s');
process.exit(1);
