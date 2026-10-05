import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createDatabase, type Database } from '../../shared/infrastructure/db/database.js';
import { Account } from '../domain/Account.js';
import type { RefreshToken } from '../domain/RefreshToken.js';
import { DrizzleAccountRepository } from './DrizzleAccountRepository.js';
import { DrizzleRefreshTokenRepository } from './DrizzleRefreshTokenRepository.js';

let database: Database;
let repository: DrizzleRefreshTokenRepository;
let accountId: string;

const NOW = new Date('2026-06-01T12:00:00.000Z');
const LATER = new Date('2026-06-08T12:00:00.000Z');

beforeAll(() => {
  // Provided by vitest.global-setup.ts once the test database exists and is migrated.
  database = createDatabase(inject('testDatabaseUrl'));
  repository = new DrizzleRefreshTokenRepository(database.db);
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.db.execute(sql`TRUNCATE TABLE accounts CASCADE`);
  accountId = randomUUID();
  await new DrizzleAccountRepository(database.db).save(
    Account.restore({
      id: accountId,
      email: 'owner@shop.com',
      passwordHash: '$2b$12$hash',
      businessName: 'Mate Shop',
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
});

let sequence = 0;

function token(overrides: Partial<RefreshToken> = {}): RefreshToken {
  sequence += 1;
  return {
    id: randomUUID(),
    accountId,
    familyId: randomUUID(),
    tokenHash: `hash-${sequence}`,
    expiresAt: LATER,
    revokedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('DrizzleRefreshTokenRepository', () => {
  it('round-trips every field through insert and findByHash', async () => {
    const stored = token({ revokedAt: new Date('2026-06-02T01:02:03.456Z') });

    await repository.insert(stored);

    expect(await repository.findByHash(stored.tokenHash)).toEqual(stored);
  });

  it('returns null for an unknown hash', async () => {
    expect(await repository.findByHash('missing')).toBeNull();
  });

  it('rejects a duplicate hash and a token for an unknown account', async () => {
    const stored = token();
    await repository.insert(stored);

    await expect(repository.insert(token({ tokenHash: stored.tokenHash }))).rejects.toThrow();
    await expect(repository.insert(token({ accountId: randomUUID() }))).rejects.toThrow();
  });

  it('rotate claims the presented token and stores the next one', async () => {
    const presented = token();
    const next = token({ familyId: presented.familyId });
    await repository.insert(presented);

    const claimed = await repository.rotate(presented.tokenHash, next, NOW);

    expect(claimed).toEqual({ ...presented, revokedAt: NOW });
    expect((await repository.findByHash(presented.tokenHash))?.revokedAt).toEqual(NOW);
    expect(await repository.findByHash(next.tokenHash)).toEqual(next);
  });

  it('a second claim of the same token returns null and stores nothing', async () => {
    const presented = token();
    await repository.insert(presented);
    await repository.rotate(presented.tokenHash, token({ familyId: presented.familyId }), NOW);
    const loserNext = token({ familyId: presented.familyId });

    const second = await repository.rotate(presented.tokenHash, loserNext, NOW);

    expect(second).toBeNull();
    expect(await repository.findByHash(loserNext.tokenHash)).toBeNull();
  });

  it('of many concurrent claims exactly one wins and only its next token is stored', async () => {
    const presented = token();
    await repository.insert(presented);
    const nexts = Array.from({ length: 8 }, () => token({ familyId: presented.familyId }));

    const results = await Promise.all(
      nexts.map((next) => repository.rotate(presented.tokenHash, next, NOW)),
    );

    expect(results.filter((result) => result !== null)).toHaveLength(1);
    const stored = await Promise.all(nexts.map((next) => repository.findByHash(next.tokenHash)));
    expect(stored.filter((row) => row !== null)).toHaveLength(1);
  });

  it('does not claim an unknown or expired token', async () => {
    const expired = token({ expiresAt: NOW });
    const next = token();
    await repository.insert(expired);

    expect(await repository.rotate('missing', next, NOW)).toBeNull();
    expect(await repository.rotate(expired.tokenHash, next, NOW)).toBeNull();
    expect(await repository.findByHash(next.tokenHash)).toBeNull();
    expect((await repository.findByHash(expired.tokenHash))?.revokedAt).toBeNull();
  });

  it('revoke is conditional: it never rewrites an existing revocation time', async () => {
    const stored = token();
    await repository.insert(stored);

    await repository.revoke(stored.tokenHash, NOW);
    await repository.revoke(stored.tokenHash, LATER);
    await repository.revoke('missing', LATER);

    expect((await repository.findByHash(stored.tokenHash))?.revokedAt).toEqual(NOW);
  });

  it('revokeFamily revokes every active token of the family and no other', async () => {
    const familyId = randomUUID();
    const active = token({ familyId });
    const alreadyRevoked = token({ familyId, revokedAt: new Date('2026-05-31T00:00:00.000Z') });
    const otherFamily = token();
    await Promise.all([active, alreadyRevoked, otherFamily].map((t) => repository.insert(t)));

    await repository.revokeFamily(familyId, NOW);

    expect((await repository.findByHash(active.tokenHash))?.revokedAt).toEqual(NOW);
    expect((await repository.findByHash(alreadyRevoked.tokenHash))?.revokedAt).toEqual(
      alreadyRevoked.revokedAt,
    );
    expect((await repository.findByHash(otherFamily.tokenHash))?.revokedAt).toBeNull();
  });

  it('deleting the account cascades to its refresh tokens', async () => {
    const stored = token();
    await repository.insert(stored);

    await database.db.execute(sql`DELETE FROM accounts WHERE id = ${accountId}`);

    expect(await repository.findByHash(stored.tokenHash)).toBeNull();
  });
});
