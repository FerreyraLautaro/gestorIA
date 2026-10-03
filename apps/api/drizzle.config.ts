import { defineConfig } from 'drizzle-kit';

// Used by `npm run db:generate` to diff the schema and write SQL migrations.
// Migrations are applied by `npm run db:migrate` (src/shared/infrastructure/db/migrate.ts).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/**/*.schema.ts',
  out: './migrations',
});
