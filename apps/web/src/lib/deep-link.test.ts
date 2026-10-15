import { describe, expect, it } from 'vitest';
import { runDeepLink, runIdFromLocation } from './deep-link.js';

describe('run deep link', () => {
  it('reads ?run=<id> from a location search string', () => {
    expect(runIdFromLocation('?run=abc-123')).toBe('abc-123');
    expect(runIdFromLocation('?other=1&run=run-9')).toBe('run-9');
    expect(runIdFromLocation('run=run-7')).toBe('run-7');
  });

  it('returns null when the param is missing or empty', () => {
    expect(runIdFromLocation('')).toBeNull();
    expect(runIdFromLocation('?other=1')).toBeNull();
    expect(runIdFromLocation('?run=')).toBeNull();
  });

  it('writes a shareable ?run=<id> search string', () => {
    expect(runDeepLink('abc-123')).toBe('?run=abc-123');
    expect(runIdFromLocation(runDeepLink('run/with space'))).toBe('run/with space');
  });
});
