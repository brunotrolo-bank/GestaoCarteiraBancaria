import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts', 'apps-script/test/**/*.test.ts', 'scripts/test/**/*.test.ts', 'frontend/*/test/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: ['packages/core/src/index.ts'],
      thresholds: { branches: 90, lines: 95, functions: 95, statements: 95 },
    },
  },
});
