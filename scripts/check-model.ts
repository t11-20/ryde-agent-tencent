import { readConfig } from '../apps/api/src/config.js';
import { createModelAdapter } from '../apps/api/src/model.js';
try {
  const adapter = createModelAdapter(readConfig());
  await adapter.complete([{role: 'user', content: 'Reply with the word ready.'}], AbortSignal.timeout(20000));
  console.log('Live model connectivity verified. No credential or response content logged.');
} catch (error) {
  // Only our sanitized diagnostics are emitted. Provider/network response bodies may contain secrets.
  const message = error instanceof Error ? error.message : '';
  console.error(/^(Model access pending:|MODEL_BASE_URL |Model request failed \(HTTP|Model returned no text)/.test(message) ? message : 'Model connectivity check failed (network, timeout or configuration).');
  process.exitCode = 1;
}
