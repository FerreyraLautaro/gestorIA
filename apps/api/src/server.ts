import { createApp } from './app.js';
import { parsePort } from './shared/config/port.js';

const port = parsePort(process.env['PORT']);

createApp().listen(port, (error?: Error) => {
  if (error) {
    console.error(`gestorIA API failed to start on port ${port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`gestorIA API listening on http://localhost:${port}`);
});
