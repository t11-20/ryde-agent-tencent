import { RunSchema, FinalActionSchema } from '@fairtrip/contracts';
import { catalog, examplesFor } from '../apps/api/src/catalog.js';
import { readFileSync } from 'node:fs';
import { validateCitations } from '@fairtrip/contracts';
const savedRun = RunSchema.parse(JSON.parse(readFileSync(new URL('../examples/run.json', import.meta.url), 'utf8')));
validateCitations(savedRun.cases, savedRun.status === 'completed' ? savedRun.result : undefined, catalog.evidence, catalog.policies);
FinalActionSchema.parse(JSON.parse(readFileSync(new URL('../examples/final-action.json', import.meta.url), 'utf8')));
for (const dispute of catalog.disputes) {
  const {cases, result} = examplesFor(dispute);
  FinalActionSchema.parse(result.action);
  RunSchema.parse({id: 'run-example', fixtureId: dispute.id, mode: 'stub', status: 'completed', dispute, cases, events: [catalog.event], result});
}
console.log('All shared contract examples validated, including four evidence envelopes, both advocate sides, both categories, action, event and completed run.');
