import { defineConfig } from 'vitest/config';

// Root test run: Lane A tests, integration tests and package tests. apps/web runs its own tests.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
  },
});
