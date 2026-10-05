import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { LoginAccount } from '../../application/LoginAccount.js';
import { Logout } from '../../application/Logout.js';
import { RefreshSession } from '../../application/RefreshSession.js';
import { RefreshTokenIssuer } from '../../application/RefreshTokenIssuer.js';
import { RegisterAccount } from '../../application/RegisterAccount.js';
import { BcryptPasswordHasher } from '../BcryptPasswordHasher.js';
import { JwtAccessTokenService } from '../JwtAccessTokenService.js';
import { Sha256RefreshTokenGenerator } from '../Sha256RefreshTokenGenerator.js';
import { InMemoryAccountRepository } from '../testing/InMemoryAccountRepository.js';
import { InMemoryRefreshTokenRepository } from '../testing/InMemoryRefreshTokenRepository.js';
import { createAuthRouter } from './authRouter.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const credentials = { email: 'owner@shop.com', password: 'correct horse' };

function buildApp() {
  const accounts = new InMemoryAccountRepository();
  const hasher = new BcryptPasswordHasher(4);
  const tokens = new JwtAccessTokenService(SECRET);
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const generator = new Sha256RefreshTokenGenerator();
  const clock = () => new Date();
  const issuer = new RefreshTokenIssuer(generator, clock);
  const app = createApp({
    routers: [
      createAuthRouter({
        registerAccount: new RegisterAccount(accounts, hasher),
        loginAccount: new LoginAccount(accounts, hasher, tokens, refreshTokens, issuer),
        refreshSession: new RefreshSession(refreshTokens, generator, issuer, tokens, clock),
        logout: new Logout(refreshTokens, generator, clock),
      }),
    ],
  });
  return { app, tokens };
}

const registerBody = { ...credentials, businessName: 'Mate Shop' };

/** Raw `Set-Cookie` line for the refresh cookie, or undefined. */
function setCookieLine(response: request.Response): string | undefined {
  const lines = (response.headers['set-cookie'] ?? []) as unknown as string[];
  return lines.find((line) => line.startsWith('refresh_token='));
}

/** The refresh cookie set by the response, formatted as a `Cookie` request header. */
function cookieHeader(response: request.Response): string {
  const line = setCookieLine(response);
  if (!line) {
    throw new Error('response did not set the refresh cookie');
  }
  return line.split(';')[0] as string;
}

async function registerAndLogin(app: ReturnType<typeof buildApp>['app']) {
  await request(app).post('/auth/register').send(registerBody).expect(201);
  return request(app).post('/auth/login').send(credentials).expect(200);
}

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

const COOKIE_ATTRIBUTES = ['Path=/auth', 'HttpOnly', 'Secure', 'SameSite=Strict'];

describe('refresh cookie on login', () => {
  it('sets an HttpOnly, Secure, SameSite=Strict cookie scoped to /auth for 7 days', async () => {
    const { app } = buildApp();

    const response = await registerAndLogin(app);

    const line = setCookieLine(response) as string;
    expect(line).toMatch(/^refresh_token=[A-Za-z0-9_-]{43};/);
    expect(line).toContain('Max-Age=604800');
    for (const attribute of COOKIE_ATTRIBUTES) {
      expect(line).toContain(attribute);
    }
    expect(JSON.stringify(response.body)).not.toContain('refresh');
  });

  it('does not set the cookie when the login fails', async () => {
    const { app } = buildApp();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@shop.com', password: 'whatever pass' })
      .expect(401);

    expect(setCookieLine(response)).toBeUndefined();
  });
});

describe('POST /auth/refresh', () => {
  it('returns a new access token and rotates the cookie; the old cookie stops working', async () => {
    const { app, tokens } = buildApp();
    const login = await registerAndLogin(app);
    const oldCookie = cookieHeader(login);

    const response = await request(app).post('/auth/refresh').set('Cookie', oldCookie).expect(200);

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    await expect(tokens.verify(response.body.accessToken)).resolves.toEqual({
      accountId: expect.any(String),
    });
    const line = setCookieLine(response) as string;
    expect(line).toContain('Max-Age=604800');
    for (const attribute of COOKIE_ATTRIBUTES) {
      expect(line).toContain(attribute);
    }
    expect(cookieHeader(response)).not.toBe(oldCookie);

    await request(app).post('/auth/refresh').set('Cookie', oldCookie).expect(401);
  });

  it('keeps rotating: each new cookie works once', async () => {
    const { app } = buildApp();
    const login = await registerAndLogin(app);

    const second = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(login))
      .expect(200);
    await request(app).post('/auth/refresh').set('Cookie', cookieHeader(second)).expect(200);
  });

  it('answers 401 problem+json and clears the cookie when it is missing', async () => {
    const { app } = buildApp();

    const response = await request(app).post('/auth/refresh').expect(401);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    const line = setCookieLine(response) as string;
    expect(line).toMatch(/^refresh_token=;/);
    expect(line).toContain('Path=/auth');
    expect(line).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('answers 401 for an unknown cookie value and ignores other cookies', async () => {
    const { app } = buildApp();

    await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'theme=dark; refresh_token=not-a-real-token; other=1')
      .expect(401);
  });

  it('reuse of a rotated cookie revokes the whole family, newest cookie included', async () => {
    const { app } = buildApp();
    const login = await registerAndLogin(app);
    const first = cookieHeader(login);
    const rotated = await request(app).post('/auth/refresh').set('Cookie', first).expect(200);
    const newest = cookieHeader(rotated);

    const replay = await request(app).post('/auth/refresh').set('Cookie', first).expect(401);

    expect(setCookieLine(replay)).toMatch(/^refresh_token=;/);
    await request(app).post('/auth/refresh').set('Cookie', newest).expect(401);
  });
});

describe('POST /auth/logout', () => {
  it('answers 204, clears the cookie with the same attributes and makes refresh fail', async () => {
    const { app } = buildApp();
    const login = await registerAndLogin(app);
    const cookie = cookieHeader(login);

    const response = await request(app).post('/auth/logout').set('Cookie', cookie).expect(204);

    const line = setCookieLine(response) as string;
    expect(line).toMatch(/^refresh_token=;/);
    for (const attribute of COOKIE_ATTRIBUTES) {
      expect(line).toContain(attribute);
    }
    await request(app).post('/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('is idempotent without a cookie or with an unknown one', async () => {
    const { app } = buildApp();

    await request(app).post('/auth/logout').expect(204);
    await request(app)
      .post('/auth/logout')
      .set('Cookie', 'refresh_token=not-a-real-token')
      .expect(204);
  });
});

describe('OpenAPI', () => {
  it('documents every auth endpoint with their error responses', async () => {
    const { app } = buildApp();

    const { body } = await request(app).get('/openapi.json').expect(200);

    const register = body.paths['/auth/register'].post;
    expect(Object.keys(register.responses)).toEqual(expect.arrayContaining(['201', '400', '409']));
    const login = body.paths['/auth/login'].post;
    expect(Object.keys(login.responses)).toEqual(expect.arrayContaining(['200', '400', '401']));
    expect(login.responses['200'].headers['Set-Cookie']).toBeDefined();
    const refresh = body.paths['/auth/refresh'].post;
    expect(Object.keys(refresh.responses)).toEqual(expect.arrayContaining(['200', '401']));
    expect(refresh.security).toEqual([{ refreshCookie: [] }]);
    const logout = body.paths['/auth/logout'].post;
    expect(Object.keys(logout.responses)).toEqual(expect.arrayContaining(['204']));
    expect(body.components.securitySchemes.refreshCookie).toEqual({
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
    });
    expect(body.components.schemas.RegisterRequest).toBeDefined();
    expect(body.components.schemas.LoginResponse).toBeDefined();
  });
});
