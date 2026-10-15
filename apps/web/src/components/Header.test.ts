import { describe, expect, it } from 'vitest';
import { modeLabel } from './Header.js';

describe('header mode label', () => {
  it('labels live, stub and unknown modes', () => {
    expect(modeLabel('live')).toBe('Live model');
    expect(modeLabel('stub')).toBe('Stub');
    expect(modeLabel('')).toBeNull();
    expect(modeLabel('weird')).toBe('weird');
  });

  it('labels replay mode with the recorded date when present', () => {
    expect(modeLabel('replay')).toBe('Replay of live run');
    expect(modeLabel('replay', '2026-10-13T14:44:17.073Z')).toBe('Replay of live run · recorded 2026-10-13');
  });
});
