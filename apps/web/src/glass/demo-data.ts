import { CategorySchema, RunSchema } from '@fairtrip/contracts';
import type { Run } from '@fairtrip/contracts';
import { z } from 'zod';
import scenarioData from './demo-scenarios.json';

const catalogue = z.object({
  notice: z.string(),
  scenarios: z.array(z.object({
    id: z.string(), label: z.string(), category: CategorySchema,
    provenance: z.enum(['recorded-live', 'scripted-demo']), run: z.unknown(),
  })).min(1),
}).parse(scenarioData);

/** Validate each recording on first use, then reuse it across replays. */
export const demoScenarios = catalogue.scenarios.map(source => {
  let recording: Run | undefined;
  return {
    id: source.id, label: source.label, category: source.category, provenance: source.provenance,
    get run(): Run {
      recording ??= RunSchema.parse(source.run);
      return recording;
    },
  };
});
