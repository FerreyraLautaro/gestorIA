/** Lifetime of a refresh token; each rotation restarts it (sliding window). */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Server-side record of an issued refresh token. The opaque value itself is never stored,
 * only its hash. Tokens created by rotation share the `familyId` of the login that started them.
 */
export interface RefreshToken {
  id: string;
  accountId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  /** Set once the token was used, logged out or revoked with its family. */
  revokedAt: Date | null;
  createdAt: Date;
}
