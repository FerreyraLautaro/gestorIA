import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../../shared/infrastructure/http/errorHandler.js';
import { JwtAccessTokenService } from '../JwtAccessTokenService.js';
import { authenticatedOwnerId, requireAuth } from './requireAuth.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const tokens = new JwtAccessTokenService(SECRET);

function buildApp() {
  const app = express();
  app.get('/private', requireAuth(tokens), (_req, res) => {
    res.json({ ownerId: authenticatedOwnerId(res) });
  });
  app.use(errorHandler);
  return app;
}

describe('requireAuth', () => {
  it('exposes the token subject as ownerId', async () => {
    const { token } = await tokens.issue(ACCOUNT_ID);

    const response = await request(buildApp())
      .get('/private')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ ownerId: ACCOUNT_ID });
  });

  it('accepts a case-insensitive scheme', async () => {
    const { token } = await tokens.issue(ACCOUNT_ID);

    await request(buildApp()).get('/private').set('Authorization', `bearer ${token}`).expect(200);
  });

  it.each([
    ['missing header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['empty token', 'Bearer '],
    ['extra segments', 'Bearer a b'],
    ['garbage token', 'Bearer not-a-jwt'],
  ])('answers 401 problem+json with a Bearer challenge for %s', async (_name, header) => {
    const call = request(buildApp()).get('/private');
    const response = await (header === undefined ? call : call.set('Authorization', header)).expect(
      401,
    );

    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('answers 401 for an expired token', async () => {
    const past = new JwtAccessTokenService(SECRET, () => new Date('2020-01-01T00:00:00Z'));
    const { token } = await past.issue(ACCOUNT_ID);

    const response = await request(buildApp())
      .get('/private')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.headers['www-authenticate']).toBe('Bearer');
  });
});
