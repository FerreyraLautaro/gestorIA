import type { RefreshToken } from './RefreshToken.js';

/** Persistence port for refresh tokens. */
export interface RefreshTokenRepository {
  insert(token: RefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /**
   * Atomically claims the presented token (still unrevoked and unexpired at `now`) by
   * revoking it, and stores `next` in the same unit of work. Returns the claimed token, or
   * null when it could not be claimed (nothing is stored then). Two concurrent calls with the
   * same hash can never both succeed.
   */
  rotate(presentedHash: string, next: RefreshToken, now: Date): Promise<RefreshToken | null>;
  /** Revokes one token if it exists and is still active; otherwise does nothing. */
  revoke(tokenHash: string, now: Date): Promise<void>;
  /** Revokes every still-active token of the family. */
  revokeFamily(familyId: string, now: Date): Promise<void>;
}
