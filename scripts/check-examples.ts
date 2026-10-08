import { readFileSync } from 'node:fs';
import { RunSchema, FinalActionSchema, validateCitations } from '@fairtrip/contracts';
import { catalog, examplesFor } from '../apps/api/src/catalog.js';

const runExample = JSON.parse(readFileSync(new URL('../examples/run.json', import.meta.url), 'utf8'));
RunSchema.parse(runExample);

const actionExample = JSON.parse(readFileSync(new URL('../examples/final-action.json', import.meta.url), 'utf8'));
FinalActionSchema.parse(actionExample);

for (const dispute of catalog.disputes) {
  const {cases, modelResponse, policies} = examplesFor(dispute);
  validateCitations(cases, modelResponse, catalog.evidence, policies);
  const result = {...modelResponse, action: actionExample};
  RunSchema.parse({id: 'run-example', fixtureId: dispute.id, mode: 'stub', status: 'completed', dispute, cases, events: [catalog.event], retrievedEvidence: [], retrievedPolicies: [], result});
}

console.log('All shared contract examples validated, including four evidence envelopes, both advocate sides, both categories, action, event and completed run.');
