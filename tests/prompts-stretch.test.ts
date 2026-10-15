import { describe, it, expect } from 'vitest';
import { judgePrompt, riskAnalystPrompt, riderAdvocatePrompt, driverAdvocatePrompt, JUDGE_CONTEXT_RULES } from '@fairtrip/agents';
import { catalog } from '../apps/api/src/catalog.js';

const dispute = catalog.disputes[0]!;

describe('stretch prompts', () => {
  it('judgePrompt carries the risk and precedent context rules', () => {
    const prompt = judgePrompt(dispute);
    expect(prompt).toContain('RISK ASSESSMENT, when present in your input, is context only');
    expect(prompt).toContain('PRECEDENTS, when present, are past rulings shown for consistency only');
    expect(prompt).toContain(JUDGE_CONTEXT_RULES);
    expect(prompt.indexOf('Cite in findings')).toBeLessThan(prompt.indexOf('RISK ASSESSMENT'));
    expect(prompt.indexOf('RISK ASSESSMENT')).toBeLessThan(prompt.indexOf('Reply with the JSON object only'));
    expect(prompt).toContain('- Under RD-4, a nav_event or traffic_advisory record is documentary evidence of a diversion. A documented closure or incident on the reference route explains a departure from that route; do not demand corroboration beyond the records in the evidence bundle.');
  });

  it('riskAnalystPrompt states the neutrality rules and the JSON shape', () => {
    const prompt = riskAnalystPrompt(dispute);
    expect(prompt).toContain('Never assert fault');
    expect(prompt).toContain('{"summary"');
    expect(prompt).toContain('SYNTHETIC');
    expect(prompt).toContain('DEMONSTRATION POLICY');
  });

  it('both advocate prompts carry the unavailable-family rule', () => {
    const rule = 'If get_evidence returns no record for a source, that family is unavailable for this dispute: do not request it again, name it in missingFacts, and produce your final case from the records that were returned. Never cite an ID that no tool returned.';
    for (const prompt of [riderAdvocatePrompt(dispute), driverAdvocatePrompt(dispute)]) {
      expect(prompt).toContain(`- ${rule}`);
      expect(prompt.indexOf(rule)).toBeLessThan(prompt.indexOf('Your final response must be a JSON object in this exact format:'));
    }
  });
});
