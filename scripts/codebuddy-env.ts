#!/usr/bin/env -S node --experimental-strip-types
// Restored from CodeBuddy's saved model bootstrap. Explicit .env or backend
// settings win; only a matching private CodeBuddy model can fill missing values.
import {readFileSync, existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {resolveCodeBuddyEnvironment, type CodeBuddyModel} from './codebuddy-model-config.js';

const configPath = join(homedir(), '.codebuddy', 'models.json');
let models: CodeBuddyModel[] = [];
if (existsSync(configPath)) {
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf8')) as {models?: CodeBuddyModel[]};
    if (Array.isArray(data.models)) models = data.models;
  } catch { /* Missing or malformed private settings are handled by config validation. */ }
}
const resolved = resolveCodeBuddyEnvironment(process.env, models);
for (const name of ['MODEL_NAME', 'MODEL_BASE_URL', 'MODEL_API_KEY'] as const) {
  if (resolved[name]) process.env[name] = resolved[name];
}
