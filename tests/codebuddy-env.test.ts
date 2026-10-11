import {describe, it, expect} from 'vitest';
import {resolveCodeBuddyEnvironment} from '../scripts/codebuddy-model-config.js';

const models = [{id: 'MiniMax-M2.5', url: 'https://provider.example/v1/chat/completions', apiKey: 'synthetic-key'}];
describe('CodeBuddy model fallback', () => {
  it('loads a matching model without changing the caller environment', () => {
    const env = {};
    expect(resolveCodeBuddyEnvironment(env, models)).toEqual({MODEL_NAME: 'MiniMax-M2.5', MODEL_BASE_URL: 'https://provider.example/v1', MODEL_API_KEY: 'synthetic-key'});
    expect(env).toEqual({});
  });
  it('preserves explicitly configured runtime values', () => {
    const env = {MODEL_NAME: 'another-model', MODEL_BASE_URL: 'https://other.example/v1', MODEL_API_KEY: 'explicit-key'};
    expect(resolveCodeBuddyEnvironment(env, models)).toEqual(env);
  });
  it('does not send the fallback key to an unmatched or unsafe endpoint', () => {
    for (const url of ['https://other.example/v1', 'http://provider.example/v1', 'https://user:pass@provider.example/v1', 'https://provider.example/v1?secret=value']) {
      const env = {MODEL_BASE_URL: url};
      expect(resolveCodeBuddyEnvironment(env, models)).toEqual(env);
    }
  });
  it('does not guess a provider for an existing unrelated runtime key', () => {
    expect(resolveCodeBuddyEnvironment({MODEL_API_KEY: 'unrelated-key'}, models)).toEqual({MODEL_API_KEY: 'unrelated-key'});
  });
  it('replaces the known placeholder only when the model and endpoint match', () => {
    const env = {MODEL_NAME: 'MiniMax-M2.5', MODEL_BASE_URL: 'https://provider.example/v1', MODEL_API_KEY: '__SET_BY_CODEBUDDY_INTEGRATION__'};
    expect(resolveCodeBuddyEnvironment(env, models).MODEL_API_KEY).toBe('synthetic-key');
  });
});
