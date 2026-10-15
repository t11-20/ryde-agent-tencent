import { z } from 'zod';
const EnvSchema = z.object({
  RUN_MODE: z.enum(['stub', 'live', 'replay']).default('stub'), API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MODEL_API_KEY: z.string().trim().default(''), MODEL_BASE_URL: z.string().trim().default(''), MODEL_NAME: z.string().trim().default(''),
  MODEL_EXTRA_BODY: z.string().trim().default(''),
  MODEL_THINKING: z.enum(['default', 'adaptive', 'off']).default('adaptive'),
  MODEL_SERVICE_TIER: z.enum(['standard', 'priority']).default('standard'),
  ESCALATION_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  // REPLAY_DIR is resolved relative to the process working directory (run from the repo root).
  REPLAY_DIR: z.string().trim().default('apps/api/replays/20261013-144417'),
  REPLAY_SPEED: z.coerce.number().positive().default(1)
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) throw new Error('Invalid environment configuration; check variable names, RUN_MODE and API_PORT');
  const config = parsed.data;
  // Replay mode serves recorded runs; model credentials are required for live mode only.
  if (config.RUN_MODE === 'live') requireModelConfig(config);
  return config;
}
export type Config = ReturnType<typeof readConfig>;
export function requireModelConfig(config: {MODEL_API_KEY: string; MODEL_BASE_URL: string; MODEL_NAME: string}) {
  const missing = (['MODEL_API_KEY', 'MODEL_BASE_URL', 'MODEL_NAME'] as const).filter(key => !config[key]);
  if (missing.length) throw new Error(`Model access pending: missing ${missing.join(', ')}`);
  let url: URL;
  try { url = new URL(config.MODEL_BASE_URL); } catch { throw new Error('MODEL_BASE_URL must be a valid HTTPS URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('MODEL_BASE_URL must be HTTPS without embedded credentials, query, or fragment');
}
