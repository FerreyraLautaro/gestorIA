import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('createApp', () => {
  it('GET /health returns ok', async () => {
    const response = await request(createApp()).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /openapi.json serves the generated OpenAPI document', async () => {
    const response = await request(createApp()).get('/openapi.json').expect(200);

    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.info.title).toBe('gestorIA API');
    expect(response.body.paths['/health'].get.responses['200']).toBeDefined();
    expect(response.body.components.schemas.ProblemDetails).toBeDefined();
    expect(response.body.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('GET /docs serves Swagger UI', async () => {
    const response = await request(createApp()).get('/docs/').expect(200);

    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toContain('swagger-ui');
  });

  it('answers unknown routes with a 404 Problem Details', async () => {
    const response = await request(createApp()).get('/nope').expect(404);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 404, title: 'Not Found', instance: '/nope' });
  });

  it('answers a malformed JSON body with a 400 Problem Details', async () => {
    const response = await request(createApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });
});
