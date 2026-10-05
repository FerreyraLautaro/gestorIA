import { randomUUID } from 'node:crypto';
import { REFRESH_TOKEN_TTL_SECONDS, type RefreshToken } from '../domain/RefreshToken.js';
import type { RefreshTokenGenerator } from '../domain/RefreshTokenGenerator.js';

export interface IssuedRefreshToken {
  /** Opaque value to hand to the client; it is not stored anywhere. */
  raw: string;
  /** Record to persist (holds only the hash). */
  token: RefreshToken;
}

/** Builds refresh token records; the caller persists them (login inserts, rotation swaps). */
export class RefreshTokenIssuer {
  /** `clock` is injectable so expiry can be tested deterministically. */
  constructor(
    private readonly generator: RefreshTokenGenerator,
    private readonly clock: () => Date,
  ) {}

  /** Starts a new family unless `familyId` is given (rotation keeps the family). */
  issue(accountId: string, familyId: string = randomUUID()): IssuedRefreshToken {
    const now = this.clock();
    const { raw, hash } = this.generator.generate();
    return {
      raw,
      token: {
        id: randomUUID(),
        accountId,
        familyId,
        tokenHash: hash,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        revokedAt: null,
        createdAt: now,
      },
    };
  }
}
