import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: [
        'server/**/*.ts',
        'server/**/*.js',
        'client/src/**/*.ts',
        'client/src/**/*.tsx'
      ],
      exclude: [
        'server/tests/**',
        'server/**/*.test.ts',
        'server/**/*.spec.ts',
        'server/dist/**',
        'client/src/**/*.test.ts',
        'client/src/**/*.spec.ts',
        'client/dist/**',
        'node_modules/**'
      ],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
        statements: 70
      }
    },
   Environment: 'node'
  }
});
