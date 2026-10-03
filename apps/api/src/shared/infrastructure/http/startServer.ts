import type { Express } from 'express';
import type { Server } from 'node:http';

/** Starts listening; resolves once bound and rejects on listen errors such as EADDRINUSE. */
export function startServer(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once('listening', () => {
      server.off('error', reject);
      resolve(server);
    });
    server.once('error', reject);
  });
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
