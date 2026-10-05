import { Router } from 'express';
import { z } from 'zod';
import { openApiRegistry, problemResponse } from '../../../shared/infrastructure/http/openapi.js';
import { validate, validated } from '../../../shared/infrastructure/http/validate.js';
import type { LoginAccount } from '../../application/LoginAccount.js';
import type { RegisterAccount } from '../../application/RegisterAccount.js';

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

const JSON_TYPE = 'application/json';

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
      content: { [JSON_TYPE]: { schema: LoginResponseSchema } },
    },
    400: problemResponse('The request body is invalid.'),
    401: problemResponse('Invalid email or password.'),
  },
});

export interface AuthRouterDependencies {
  registerAccount: RegisterAccount;
  loginAccount: LoginAccount;
}

export function createAuthRouter({
  registerAccount,
  loginAccount,
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
    const { accessToken, expiresIn } = await loginAccount.execute(body);
    res.json({ accessToken, tokenType: 'Bearer', expiresIn });
  });

  return router;
}
