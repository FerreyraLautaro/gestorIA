import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';

function appWith(handler: RequestHandler): Express {
  const app = express();
  app.use(express.json());
  app.post('/boom', handler);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function throwing(error: unknown): RequestHandler {
  return () => {
    throw error;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('maps ValidationError to 400 with a field-level error', async () => {
    const response = await request(appWith(throwing(new ValidationError('price', 'price is bad'))))
      .post('/boom')
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'price is bad',
      instance: '/boom',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'price', message: 'price is bad' }],
    });
  });

  it('maps ZodError to 400 with dotted field paths', async () => {
    const schema = z.object({ name: z.string(), tags: z.array(z.object({ id: z.number() })) });
    const result = schema.safeParse({ name: 1, tags: [{ id: 'x' }] });
    expect(result.success).toBe(false);

    const response = await request(appWith(throwing(result.error))).post('/boom').expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body.title).toBe('Bad Request');
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.map((e: { field: string }) => e.field)).toEqual([
      'name',
      'tags.0.id',
    ]);
    expect(response.body.errors[0].message).toEqual(expect.any(String));
  });

  it('maps a malformed JSON body to 400', async () => {
    const response = await request(appWith((_req, res) => void res.sendStatus(204)))
      .post('/boom')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      instance: '/boom',
    });
    expect(response.body.detail).toMatch(/JSON/i);
  });

  it('maps NotFoundError to 404', async () => {
    const response = await request(appWith(throwing(new NotFoundError('Product', 'p-1'))))
      .post('/boom')
      .expect(404);

    expect(response.body).toMatchObject({
      title: 'Not Found',
      status: 404,
      detail: 'Product p-1 was not found',
      code: 'NOT_FOUND',
    });
    expect(response.body.errors).toBeUndefined();
  });

  it('maps unknown errors to a generic 500 without leaking internals and logs them', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const secret = new Error('connection string postgres://user:secret@db');

    const response = await request(appWith(throwing(secret))).post('/boom').expect(500);

    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      instance: '/boom',
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(log).toHaveBeenCalledWith(expect.any(String), secret);
  });

  it('returns a 404 Problem Details for unknown routes', async () => {
    const response = await request(appWith(() => undefined)).get('/nope').expect(404);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Route GET /nope was not found.',
      instance: '/nope',
    });
  });
});
