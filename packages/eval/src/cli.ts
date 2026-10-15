import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runEval } from './index.js';

function positiveInt(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer, got "${value}"`);
  return parsed;
}

function stamp(): string {
  const digits = new Date().toISOString().replace(/\D/g, '');
  return `${digits.slice(0, 8)}-${digits.slice(8, 14)}`;
}

async function main(): Promise<number> {
  const {values} = parseArgs({options: {
    fixtures: {type: 'string', default: 'golden'}, repeat: {type: 'string', default: '1'},
    // 200 s covers one automatic re-run after a first-attempt failure (90 s per attempt).
    'base-url': {type: 'string', default: 'http://127.0.0.1:3001'}, 'timeout-sec': {type: 'string', default: '200'},
    'poll-ms': {type: 'string', default: '1000'}, 'release-gate': {type: 'boolean', default: false}, out: {type: 'string'}
  }});
  const outDir = values.out ?? join(fileURLToPath(new URL('../results/', import.meta.url)), stamp());
  console.log('Note: run one gate at a time against an idle API; concurrent gates share the model budget and the precedent store.');
  const report = await runEval({
    baseUrl: values['base-url'],
    fixtures: values.fixtures,
    repeat: positiveInt('repeat', values.repeat),
    pollMs: positiveInt('poll-ms', values['poll-ms']),
    timeoutSec: positiveInt('timeout-sec', values['timeout-sec']),
    releaseGate: values['release-gate'],
    outDir
  });
  console.log(`Scorecard: ${report.outDir}/scorecard.md`);
  if (report.gate !== null) {
    console.log(`Release gate: ${report.gate.passed ? 'PASS' : 'FAIL'}`);
    return report.gate.passed ? 0 : 1;
  }
  return report.runs.every(run => run.passed) ? 0 : 1;
}

main().then(code => { process.exitCode = code; }, (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
