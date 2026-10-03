import { defineConfig } from 'vitest/config';

const INTEGRATION_TESTS = 'src/**/*.int.test.ts';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: [INTEGRATION_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: [INTEGRATION_TESTS],
          // Creates and migrates the dedicated test database before any integration file runs.
          globalSetup: ['./vitest.global-setup.ts'],
          // Integration files share one database; run them one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
