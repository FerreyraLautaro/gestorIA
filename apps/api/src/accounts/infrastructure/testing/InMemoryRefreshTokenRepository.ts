import type { RefreshToken } from '../../domain/RefreshToken.js';
import type { RefreshTokenRepository } from '../../domain/RefreshTokenRepository.js';

/** Test double for the refresh token port with the same semantics as the Drizzle adapter. */
export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshToken>();

  async insert(token: RefreshToken): Promise<void> {
    this.tokens.set(token.tokenHash, { ...token });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const found = this.tokens.get(tokenHash);
    return found ? { ...found } : null;
  }

  async rotate(
    presentedHash: string,
    next: RefreshToken,
    now: Date,
  ): Promise<RefreshToken | null> {
    const found = this.tokens.get(presentedHash);
    if (!found || found.revokedAt !== null || found.expiresAt <= now) {
      return null;
    }
    found.revokedAt = now;
    this.tokens.set(next.tokenHash, { ...next });
    return { ...found };
  }

  async revoke(tokenHash: string, now: Date): Promise<void> {
    const found = this.tokens.get(tokenHash);
    if (found && found.revokedAt === null) {
      found.revokedAt = now;
    }
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.familyId === familyId && token.revokedAt === null) {
        token.revokedAt = now;
      }
    }
  }
}
