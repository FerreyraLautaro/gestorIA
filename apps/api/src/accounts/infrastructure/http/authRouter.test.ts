import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { LoginAccount } from '../../application/LoginAccount.js';
import { RegisterAccount } from '../../application/RegisterAccount.js';
import { BcryptPasswordHasher } from '../BcryptPasswordHasher.js';
import { JwtAccessTokenService } from '../JwtAccessTokenService.js';
import { InMemoryAccountRepository } from '../testing/InMemoryAccountRepository.js';
import { createAuthRouter } from './authRouter.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const credentials = { email: 'owner@shop.com', password: 'correct horse' };

function buildApp() {
  const accounts = new InMemoryAccountRepository();
  const hasher = new BcryptPasswordHasher(4);
  const tokens = new JwtAccessTokenService(SECRET);
  const app = createApp({
    routers: [
      createAuthRouter({
        registerAccount: new RegisterAccount(accounts, hasher),
        loginAccount: new LoginAccount(accounts, hasher, tokens),
      }),
    ],
  });
  return { app, tokens };
}

const registerBody = { ...credentials, businessName: 'Mate Shop' };

describe('POST /auth/register', () => {
  it('creates the account and never exposes the password or its hash', async () => {
    const { app } = buildApp();

    const response = await request(app).post('/auth/register').send(registerBody).expect(201);

    expect(response.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      email: 'owner@shop.com',
      businessName: 'Mate Shop',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|hash|\$2/i);
  });

  it('answers 409 problem+json when the email is already registered', async () => {
    const { app } = buildApp();
    await request(app).post('/auth/register').send(registerBody).expect(201);

    const response = await request(app)
      .post('/auth/register')
      .send({ ...registerBody, email: 'OWNER@shop.com' })
      .expect(409);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 409, code: 'CONFLICT' });
  });

  it('answers 400 with field errors for a missing or wrongly typed body', async () => {
    const { app } = buildApp();

    const response = await request(app).post('/auth/register').send({ email: 5 }).expect(400);

    const fields = response.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'businessName']));
  });

  it('answers 400 for a weak password and for an invalid email', async () => {
    const { app } = buildApp();

    const weak = await request(app)
      .post('/auth/register')
      .send({ ...registerBody, password: 'short' })
      .expect(400);
    const badEmail = await request(app)
      .post('/auth/register')
      .send({ ...registerBody, email: 'nope' })
      .expect(400);

    expect(weak.body.errors[0].field).toBe('password');
    expect(badEmail.body.errors[0].field).toBe('email');
  });
});

describe('POST /auth/login', () => {
  it('returns a Bearer access token valid for 900 seconds that verifies to the account', async () => {
    const { app, tokens } = buildApp();
    const registered = await request(app).post('/auth/register').send(registerBody).expect(201);

    const response = await request(app).post('/auth/login').send(credentials).expect(200);

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(await tokens.verify(response.body.accessToken)).toEqual({
      accountId: registered.body.id,
    });
  });

  it('answers the same 401 for a wrong password and for an unknown email', async () => {
    const { app } = buildApp();
    await request(app).post('/auth/register').send(registerBody).expect(201);

    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ ...credentials, password: 'wrong password' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@shop.com', password: 'whatever pass' })
      .expect(401);

    expect(wrongPassword.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(unknownEmail.body.detail).toBe('invalid email or password');
    expect(unknownEmail.body).toEqual({ ...wrongPassword.body });
  });

  it('answers 400 for a missing body', async () => {
    const { app } = buildApp();

    await request(app).post('/auth/login').send({}).expect(400);
  });
});

describe('OpenAPI', () => {
  it('documents both auth endpoints with their error responses', async () => {
    const { app } = buildApp();

    const { body } = await request(app).get('/openapi.json').expect(200);

    const register = body.paths['/auth/register'].post;
    expect(Object.keys(register.responses)).toEqual(expect.arrayContaining(['201', '400', '409']));
    const login = body.paths['/auth/login'].post;
    expect(Object.keys(login.responses)).toEqual(expect.arrayContaining(['200', '400', '401']));
    expect(body.components.schemas.RegisterRequest).toBeDefined();
    expect(body.components.schemas.LoginResponse).toBeDefined();
  });
});
