import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { runMigrations } from './src/shared/infrastructure/db/migrator.js';
import {
  deriveTestDatabaseUrl,
  ensureDatabaseExists,
} from './src/shared/infrastructure/db/testing/testDatabase.js';

/**
 * Prepares the dedicated test database for integration tests.
 *
 * Env loading: global setup runs in the main Vitest process before any worker starts,
 * so the API env file is loaded here with `process.loadEnvFile` (only when it exists;
 * variables already set in the environment win). This keeps `vitest` usable directly,
 * without an env-file flag on every test script.
 *
 * The test database is `DATABASE_URL` with `_test` appended to its name, so development
 * data is never touched. Its URL reaches test files through `provide`/`inject`.
 */
export default async function setup(project: TestProject): Promise<void> {
  const envFile = fileURLToPath(new URL('./.env', import.meta.url));
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set: integration tests need PostgreSQL (see apps/api/.env.example).',
    );
  }

  const testDatabaseUrl = deriveTestDatabaseUrl(databaseUrl);
  await ensureDatabaseExists(testDatabaseUrl);
  await runMigrations(testDatabaseUrl);

  project.provide('testDatabaseUrl', testDatabaseUrl);
}
