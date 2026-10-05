import type { CookieOptions, Request, Response } from 'express';
import { REFRESH_TOKEN_TTL_SECONDS } from '../../domain/RefreshToken.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

// Scoped to /auth so the browser sends it only to the endpoints that need it.
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth',
};

export function setRefreshCookie(res: Response, rawToken: string): void {
  // Express takes maxAge in milliseconds and emits both Max-Age and Expires.
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

/** Must repeat the Path (and should repeat the other attributes) or browsers keep the cookie. */
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_OPTIONS);
}

/**
 * Reads the refresh cookie from the raw `Cookie` header. A local helper instead of
 * `cookie-parser`: the API reads exactly one cookie, so a dependency would be bigger
 * than the code it replaces.
 */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator !== -1 && pair.slice(0, separator).trim() === REFRESH_COOKIE_NAME) {
      return pair.slice(separator + 1).trim();
    }
  }
  return undefined;
}
