import { createApp } from './app.js';
import { readConfig } from './config.js';
try {
  const config = readConfig();
  const server = createApp(config).listen(config.API_PORT, config.API_HOST, () => {
    console.log(`FairTrip ${config.RUN_MODE.toUpperCase()} API listening on ${config.API_HOST}:${config.API_PORT}. ${config.RUN_MODE === 'stub' ? 'Development stubs; no model requests.' : 'Synthetic contract examples; model authentication is checked on invocation.'}`);
  });
  server.on('error', () => {console.error('API startup failed; check host/port availability.'); process.exitCode = 1;});
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
} catch (error) {console.error(error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1;}
