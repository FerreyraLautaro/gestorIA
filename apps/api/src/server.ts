import { createApp } from './app.js';

const DEFAULT_PORT = 3000;
const port = Number(process.env['PORT'] ?? DEFAULT_PORT);

createApp().listen(port, () => {
  console.log(`gestorIA API listening on http://localhost:${port}`);
});
