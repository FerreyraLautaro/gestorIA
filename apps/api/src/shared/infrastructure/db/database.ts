import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type DrizzleDb = NodePgDatabase<typeof schema>;

export interface Database {
  db: DrizzleDb;
  /** Closes every pooled connection; call once on shutdown. */
  close(): Promise<void>;
}

/** Creates a connection pool and its Drizzle client. Connections open lazily on first query. */
export function createDatabase(connectionString: string): Database {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema });
  return {
    db,
    close: () => pool.end(),
  };
}
