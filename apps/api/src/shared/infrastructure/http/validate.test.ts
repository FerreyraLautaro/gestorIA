import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from './errorHandler.js';
import { validate, validated } from './validate.js';

const schemas = {
  body: z.object({ name: z.string().min(1) }),
  query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  params: z.object({ id: z.uuid() }),
};

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.post('/items/:id', validate(schemas), (_req, res) => {
    const { body, query, params } = validated(res, schemas);
    res.json({ name: body.name, page: query.page, id: params.id, pageType: typeof query.page });
  });
  app.get('/only-query', validate({ query: schemas.query }), (_req, res) => {
    res.json(validated(res, { query: schemas.query }).query);
  });
  app.use(errorHandler);
  return app;
}

const ID = '3f1b3a0e-8f3c-4a43-9a53-0a2b1f5d9c11';

describe('validate', () => {
  it('exposes parsed (coerced and defaulted) values to the handler', async () => {
    const response = await request(buildApp())
      .post(`/items/${ID}?page=3`)
      .send({ name: 'Mate' })
      .expect(200);

    expect(response.body).toEqual({ name: 'Mate', page: 3, id: ID, pageType: 'number' });
  });

  it('applies schema defaults', async () => {
    const response = await request(buildApp()).get('/only-query').expect(200);

    expect(response.body).toEqual({ page: 1 });
  });

  it('forwards a ZodError as a 400 Problem Details with every failing field', async () => {
    const response = await request(buildApp())
      .post('/items/not-a-uuid?page=0')
      .send({ name: '' })
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    const fields = response.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(['id', 'name', 'page']);
  });

  it('only validates the parts it was given schemas for', async () => {
    await request(buildApp()).get('/only-query?ignored=1').expect(200);
  });
});
