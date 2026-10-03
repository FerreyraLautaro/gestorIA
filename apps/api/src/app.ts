import express, { type Express, type Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { errorHandler, notFoundHandler } from './shared/infrastructure/http/errorHandler.js';
import { healthRouter } from './shared/infrastructure/http/health.js';
import { buildOpenApiDocument } from './shared/infrastructure/http/openapi.js';

export interface AppDependencies {
  /** Feature routers, mounted at the root. Each registers its own OpenAPI paths. */
  routers?: readonly Router[];
}

export function createApp({ routers = [] }: AppDependencies = {}): Express {
  const app = express();
  app.use(express.json());

  const document = buildOpenApiDocument();
  app.get('/openapi.json', (_req, res) => {
    res.json(document);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(document));

  app.use(healthRouter);
  for (const router of routers) {
    app.use(router);
  }

  // Order matters: unmatched routes become 404 problems, then every error is mapped.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
