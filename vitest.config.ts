import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.svelte-kit/**', 'build/**'],
    environment: 'node',
    passWithNoTests: false,
    testTimeout: 10000,
    fileParallelism: false
  }
});
