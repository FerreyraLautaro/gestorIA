import { Router } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
import { openApiRegistry, problemResponse } from '../../../shared/infrastructure/http/openapi.js';
import { validate, validated } from '../../../shared/infrastructure/http/validate.js';
import type { LoginAccount } from '../../application/LoginAccount.js';
import type { Logout } from '../../application/Logout.js';
import type { RefreshSession } from '../../application/RefreshSession.js';
import type { RegisterAccount } from '../../application/RegisterAccount.js';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refreshCookie.js';

const RegisterRequestSchema = z
  .object({
    email: z.string().meta({ example: 'owner@shop.com' }),
    password: z
      .string()
      .meta({
        description: '8 characters minimum, 72 UTF-8 bytes maximum.',
        example: 'correct horse',
      }),
    businessName: z.string().meta({ example: 'Mate Shop' }),
  })
  .meta({ id: 'RegisterRequest' });

const AccountResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.string().meta({ example: 'owner@shop.com' }),
    businessName: z.string().meta({ example: 'Mate Shop' }),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'AccountResponse' });

const LoginRequestSchema = z
  .object({
    email: z.string().meta({ example: 'owner@shop.com' }),
    password: z.string().min(1).max(1024).meta({ example: 'correct horse' }),
  })
  .meta({ id: 'LoginRequest' });

const LoginResponseSchema = z
  .object({
    accessToken: z
      .string()
      .meta({ description: 'JWT to send as `Authorization: Bearer <token>`.' }),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int().meta({ description: 'Lifetime in seconds.', example: 900 }),
  })
  .meta({ id: 'LoginResponse' });

const REFRESH_COOKIE_SCHEME = 'refreshCookie';
const JSON_TYPE = 'application/json';
const SET_COOKIE_DESCRIPTION =
  `Sets the \`${REFRESH_COOKIE_NAME}\` cookie (HttpOnly, Secure, SameSite=Strict, Path=/auth, ` +
  'Max-Age=604800).';

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Register an account',
  request: {
    body: { required: true, content: { [JSON_TYPE]: { schema: RegisterRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Account created.',
      content: { [JSON_TYPE]: { schema: AccountResponseSchema } },
    },
    400: problemResponse('Invalid email, password or business name.'),
    409: problemResponse('The email is already registered.'),
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Log in with email and password',
  request: { body: { required: true, content: { [JSON_TYPE]: { schema: LoginRequestSchema } } } },
  responses: {
    200: {
      description: 'Credentials accepted; returns a 15-minute access token.',
      headers: {
        'Set-Cookie': {
          description: SET_COOKIE_DESCRIPTION,
          schema: { type: 'string' },
        },
      },
      content: { [JSON_TYPE]: { schema: LoginResponseSchema } },
    },
    400: problemResponse('The request body is invalid.'),
    401: problemResponse('Invalid email or password.'),
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Rotate the refresh token and get a new access token',
  description:
    'Reads the `refresh_token` cookie. The presented token is revoked and replaced by a new one ' +
    'valid for 7 days. Presenting a token that was already used revokes every token issued ' +
    'since that login.',
  security: [{ [REFRESH_COOKIE_SCHEME]: [] }],
  responses: {
    200: {
      description: 'Session refreshed; returns a new 15-minute access token.',
      headers: {
        'Set-Cookie': {
          description: SET_COOKIE_DESCRIPTION,
          schema: { type: 'string' },
        },
      },
      content: { [JSON_TYPE]: { schema: LoginResponseSchema } },
    },
    401: problemResponse(
      'The refresh cookie is missing, unknown, expired or already used. The cookie is cleared.',
    ),
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Log out',
  description:
    'Revokes the refresh token in the `refresh_token` cookie, if any, and clears the cookie. ' +
    'Always succeeds, even without a valid cookie.',
  security: [{ [REFRESH_COOKIE_SCHEME]: [] }],
  responses: {
    204: { description: 'Logged out; the refresh cookie is cleared.' },
  },
});

export interface AuthRouterDependencies {
  registerAccount: RegisterAccount;
  loginAccount: LoginAccount;
  refreshSession: RefreshSession;
  logout: Logout;
}

export function createAuthRouter({
  registerAccount,
  loginAccount,
  refreshSession,
  logout,
}: AuthRouterDependencies): Router {
  const router = Router();

  const register = { body: RegisterRequestSchema };
  router.post('/auth/register', validate(register), async (_req, res) => {
    const { body } = validated(res, register);
    const account = await registerAccount.execute(body);
    res.status(201).json({
      id: account.id,
      email: account.email,
      businessName: account.businessName,
      createdAt: account.createdAt.toISOString(),
    });
  });

  const login = { body: LoginRequestSchema };
  router.post('/auth/login', validate(login), async (_req, res) => {
    const { body } = validated(res, login);
    const { accessToken, expiresIn, refreshToken } = await loginAccount.execute(body);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, tokenType: 'Bearer', expiresIn });
  });

  router.post('/auth/refresh', async (req, res) => {
    try {
      const { accessToken, expiresIn, refreshToken } = await refreshSession.execute(
        readRefreshCookie(req),
      );
      setRefreshCookie(res, refreshToken);
      res.json({ accessToken, tokenType: 'Bearer', expiresIn });
    } catch (error) {
      // A rejected token is useless to the browser: drop it so it is not sent again.
      if (error instanceof UnauthorizedError) {
        clearRefreshCookie(res);
      }
      throw error;
    }
  });

  router.post('/auth/logout', async (req, res) => {
    await logout.execute(readRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(204).end();
  });

  return router;
}
