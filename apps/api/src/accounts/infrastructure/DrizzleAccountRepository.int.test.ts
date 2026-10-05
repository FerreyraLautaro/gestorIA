import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { ConflictError } from '../../shared/domain/errors.js';
import { createDatabase, type Database } from '../../shared/infrastructure/db/database.js';
import { Account, type AccountState } from '../domain/Account.js';
import { DrizzleAccountRepository } from './DrizzleAccountRepository.js';

let database: Database;
let repository: DrizzleAccountRepository;

beforeAll(() => {
  // Provided by vitest.global-setup.ts once the test database exists and is migrated.
  database = createDatabase(inject('testDatabaseUrl'));
  repository = new DrizzleAccountRepository(database.db);
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.db.execute(sql`TRUNCATE TABLE accounts`);
});

let sequence = 0;

function accountState(overrides: Partial<AccountState> = {}): AccountState {
  sequence += 1;
  const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence));
  return {
    id: randomUUID(),
    email: `owner${sequence}@shop.com`,
    passwordHash: `$2b$12$hash${sequence}`,
    businessName: `Shop ${sequence}`,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('DrizzleAccountRepository', () => {
  it('round-trips every field through findById and findByEmail', async () => {
    const state = accountState({
      createdAt: new Date('2026-03-01T10:00:00.123Z'),
      updatedAt: new Date('2026-03-02T11:30:00.456Z'),
    });

    await repository.save(Account.restore(state));

    expect(await repository.findById(state.id).then((found) => ({ ...found }))).toEqual(state);
    const byEmail = await repository.findByEmail(state.email);
    expect(byEmail).toBeInstanceOf(Account);
    expect({ ...byEmail }).toEqual(state);
  });

  it('normalizes the email on lookup', async () => {
    const state = accountState({ email: 'owner@shop.com' });
    await repository.save(Account.restore(state));

    expect((await repository.findByEmail('  OWNER@Shop.com '))?.id).toBe(state.id);
  });

  it('returns null for unknown id or email', async () => {
    expect(await repository.findById(randomUUID())).toBeNull();
    expect(await repository.findByEmail('nobody@shop.com')).toBeNull();
  });

  it('throws ConflictError when the email is already registered', async () => {
    await repository.save(Account.restore(accountState({ email: 'owner@shop.com' })));

    await expect(
      repository.save(Account.restore(accountState({ email: 'owner@shop.com' }))),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('updates the stored row when saving an existing id', async () => {
    const original = accountState();
    await repository.save(Account.restore(original));

    const updated = {
      ...original,
      businessName: 'Renamed',
      updatedAt: new Date('2026-05-05T00:00:00.000Z'),
    };
    await repository.save(Account.restore(updated));

    expect({ ...(await repository.findById(original.id)) }).toEqual(updated);
  });
});
