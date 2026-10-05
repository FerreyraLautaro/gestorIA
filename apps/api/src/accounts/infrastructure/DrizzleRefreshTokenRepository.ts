import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DrizzleDb } from '../../shared/infrastructure/db/database.js';
import type { RefreshToken } from '../domain/RefreshToken.js';
import type { RefreshTokenRepository } from '../domain/RefreshTokenRepository.js';
import { refreshTokens, type RefreshTokenRow } from './refreshTokens.schema.js';

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: DrizzleDb) {}

  async insert(token: RefreshToken): Promise<void> {
    await this.db.insert(refreshTokens).values(toRow(token));
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async rotate(
    presentedHash: string,
    next: RefreshToken,
    now: Date,
  ): Promise<RefreshToken | null> {
    return this.db.transaction(async (tx) => {
      // The WHERE clause is the claim: a concurrent claim blocks on the row lock, then
      // re-checks `revoked_at IS NULL` against the committed row and matches nothing.
      const [claimed] = await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(
          and(
            eq(refreshTokens.tokenHash, presentedHash),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, now),
          ),
        )
        .returning();
      if (!claimed) {
        return null;
      }
      await tx.insert(refreshTokens).values(toRow(next));
      return toDomain(claimed);
    });
  }

  async revoke(tokenHash: string, now: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }
}

function toRow(token: RefreshToken): RefreshTokenRow {
  return { ...token };
}

function toDomain(row: RefreshTokenRow): RefreshToken {
  return { ...row };
}
