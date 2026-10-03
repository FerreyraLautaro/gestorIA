import { createApp } from './app.js';
import { parsePort } from './shared/config/port.js';
import { startServer } from './shared/infrastructure/http/startServer.js';

try {
  const port = parsePort(process.env['PORT']);
  await startServer(createApp(), port);
  console.log(`gestorIA API listening on http://localhost:${port}`);
} catch (error) {
  console.error(
    `gestorIA API failed to start: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
