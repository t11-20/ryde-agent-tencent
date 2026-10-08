import { createApp } from './app.js';
import { readConfig } from './config.js';
try {
  const config = readConfig();
  const server = createApp(config).listen(config.API_PORT, config.API_HOST, () => {
    console.log(`FairTrip STUB API listening on ${config.API_HOST}:${config.API_PORT}. Live model access pending.`);
  });
  server.on('error', () => {console.error('API startup failed; check host/port availability.'); process.exitCode = 1;});
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
} catch (error) {console.error(error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1;}
