import { SignJWT, jwtVerify } from 'jose';
import { UnauthorizedError } from '../../shared/domain/errors.js';
import type { AccessTokenService, IssuedAccessToken } from '../domain/AccessTokenService.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const TOKEN_ISSUER = 'gestoria-api';
const ALGORITHM = 'HS256';

/** HS256 JWT access tokens (`sub` = account id) backed by `jose`. */
export class JwtAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  /** `clock` is injectable so expiry can be tested deterministically. */
  constructor(
    secret: string,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(accountId: string): Promise<IssuedAccessToken> {
    const issuedAt = Math.floor(this.clock().getTime() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(accountId)
      .setIssuer(TOKEN_ISSUER)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.key);
    return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  async verify(token: string): Promise<{ accountId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: TOKEN_ISSUER,
        currentDate: this.clock(),
      });
      if (!payload.sub) {
        throw new Error('token has no subject');
      }
      return { accountId: payload.sub };
    } catch {
      // Expired, tampered, wrong algorithm or malformed all look the same to callers.
      throw new UnauthorizedError('invalid or expired access token');
    }
  }
}
