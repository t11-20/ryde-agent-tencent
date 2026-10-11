import { describe, expect, it } from 'vitest';
import { EVIDENCE_PACKAGE_VERSION } from '../src/index.js';

describe('evidence package', () => {
  it('is wired into the root test run', () => {
    expect(EVIDENCE_PACKAGE_VERSION).toBe('0.1.0');
  });
});
