import type { RequestHandler, Response } from 'express';
import { UnauthorizedError } from '../../../shared/domain/errors.js';
import type { AccessTokenService } from '../../domain/AccessTokenService.js';

const OWNER_ID_KEY = 'ownerId';
const BEARER_HEADER = /^Bearer ([^\s]+)$/i;

/**
 * Requires a valid `Authorization: Bearer <token>` header and exposes the account id as
 * the owner id (read it with `authenticatedOwnerId`). Anything else is a 401 Problem
 * Details response carrying a `WWW-Authenticate: Bearer` challenge.
 */
export function requireAuth(tokens: AccessTokenService): RequestHandler {
  return async (req, res, next) => {
    const token = BEARER_HEADER.exec(req.get('Authorization') ?? '')?.[1];
    try {
      if (!token) {
        throw new UnauthorizedError('a valid bearer access token is required');
      }
      const { accountId } = await tokens.verify(token);
      res.locals[OWNER_ID_KEY] = accountId;
      next();
    } catch (error) {
      res.set('WWW-Authenticate', 'Bearer');
      next(error);
    }
  };
}

/** The owner id set by `requireAuth`; only valid on routes behind that middleware. */
export function authenticatedOwnerId(res: Response): string {
  return res.locals[OWNER_ID_KEY] as string;
}
