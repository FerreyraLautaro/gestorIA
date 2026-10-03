import { Client } from 'pg';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection string of the migrated test database (see vitest.global-setup.ts). */
    testDatabaseUrl: string;
  }
}

const TEST_SUFFIX = '_test';

/** Derives the test database URL by appending `_test` to the database name. */
export function deriveTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (name.length === 0) {
    throw new Error('DATABASE_URL must include a database name');
  }
  if (!name.endsWith(TEST_SUFFIX)) {
    url.pathname = `/${encodeURIComponent(name + TEST_SUFFIX)}`;
  }
  return url.toString();
}

/** Creates the database named in `databaseUrl` if missing, via the `postgres` maintenance DB. */
export async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) {
      // Identifiers cannot be parameterized; escape embedded quotes.
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}
