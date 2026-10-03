import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { PROBLEM_CONTENT_TYPE, ProblemDetailsSchema } from './problem.js';

/**
 * Shared registry: features register their paths and schemas here (at module load)
 * and `buildOpenApiDocument` turns everything into the served spec. Schemas get their
 * component name from Zod `.meta({ id })`, so no `extendZodWithOpenApi` patching is needed.
 */
export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

/** Response definition for error cases, documented as RFC 9457 Problem Details. */
export function problemResponse(description: string) {
  return {
    description,
    content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemDetailsSchema } },
  };
}

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3([
    ...openApiRegistry.definitions,
    { type: 'schema', schema: ProblemDetailsSchema },
  ]).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'gestorIA API',
      version: '0.1.0',
      description: 'REST API for small businesses to manage their product catalog.',
    },
  });
}
