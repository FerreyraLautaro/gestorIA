import { Router } from 'express';
import { z } from 'zod';
import { openApiRegistry } from './openapi.js';

const HealthResponseSchema = z.object({ status: z.literal('ok') }).meta({ id: 'HealthResponse' });

openApiRegistry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness check',
  responses: {
    200: {
      description: 'The API is running.',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
  },
});

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
