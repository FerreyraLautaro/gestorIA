// CLI entry point: `npm run db:migrate -w @gestoria/api`.
import { runMigrations } from './migrator.js';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  console.error('DATABASE_URL is not set. Define it in apps/api/.env or in the environment.');
  process.exit(1);
}

try {
  await runMigrations(connectionString);
  console.log('Database migrations applied.');
} catch (error) {
  console.error('Database migration failed:', error);
  process.exit(1);
}
