import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../shared/domain/errors.js';
import { Account } from '../../domain/Account.js';
import { InMemoryAccountRepository } from './InMemoryAccountRepository.js';

const account = (email: string) =>
  Account.create({ email, passwordHash: 'hash', businessName: 'Shop' });

describe('InMemoryAccountRepository', () => {
  it('finds an account by id and by (normalized) email', async () => {
    const repository = new InMemoryAccountRepository();
    const saved = account('owner@shop.com');
    await repository.save(saved);

    expect(await repository.findById(saved.id)).toEqual(saved);
    expect(await repository.findByEmail('  OWNER@shop.com ')).toEqual(saved);
  });

  it('returns null for unknown accounts', async () => {
    const repository = new InMemoryAccountRepository();

    expect(await repository.findById('missing')).toBeNull();
    expect(await repository.findByEmail('nobody@shop.com')).toBeNull();
  });

  it('rejects a second account with the same email', async () => {
    const repository = new InMemoryAccountRepository();
    await repository.save(account('owner@shop.com'));

    await expect(repository.save(account('owner@shop.com'))).rejects.toBeInstanceOf(ConflictError);
  });
});
