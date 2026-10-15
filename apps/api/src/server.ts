import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createFixtureSource } from '@fairtrip/evidence';
import { replaySourceName } from './replay.js';
try {
  const config = readConfig();
  // Live and replay both serve the Lane B fixture source; replay replays recorded runs without a model.
  const source = (config.RUN_MODE === 'live' || config.RUN_MODE === 'replay') ? createFixtureSource() : undefined;
  const server = createApp(config, undefined, source).listen(config.API_PORT, config.API_HOST, () => {
    console.log(`FairTrip ${config.RUN_MODE.toUpperCase()} API listening on ${config.API_HOST}:${config.API_PORT}. ${
      config.RUN_MODE === 'stub' ? 'Development stubs; no model requests.'
        : config.RUN_MODE === 'replay' ? `Replaying live run ${replaySourceName(config.REPLAY_DIR)} at ${config.REPLAY_SPEED}x; no model calls.`
        : 'SYNTHETIC fixtures and DEMONSTRATION POLICY; model authentication is checked on invocation.'}`);
  });
  server.on('error', () => {console.error('API startup failed; check host/port availability.'); process.exitCode = 1;});
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
} catch (error) {console.error(error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1;}
