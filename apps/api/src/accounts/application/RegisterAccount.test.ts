import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../shared/domain/errors.js';
import { FakePasswordHasher } from '../infrastructure/testing/FakePasswordHasher.js';
import { InMemoryAccountRepository } from '../infrastructure/testing/InMemoryAccountRepository.js';
import { RegisterAccount } from './RegisterAccount.js';

const input = { email: 'Owner@Shop.com', password: 'correct horse', businessName: 'Mate Shop' };

function setup() {
  const accounts = new InMemoryAccountRepository();
  const hasher = new FakePasswordHasher();
  return { accounts, hasher, registerAccount: new RegisterAccount(accounts, hasher) };
}

describe('RegisterAccount', () => {
  it('creates and saves an account storing only the password hash', async () => {
    const { accounts, registerAccount } = setup();

    const account = await registerAccount.execute(input);

    expect(account.email).toBe('owner@shop.com');
    expect(account.businessName).toBe('Mate Shop');
    expect(account.passwordHash).toBe('hashed:correct horse');
    expect(await accounts.findByEmail('owner@shop.com')).toEqual(account);
  });

  it('rejects an already registered email, ignoring case and spacing', async () => {
    const { registerAccount } = setup();
    await registerAccount.execute(input);

    await expect(
      registerAccount.execute({ ...input, email: '  owner@SHOP.com ' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const { accounts, registerAccount } = setup();

    await expect(registerAccount.execute({ ...input, password: '1234567' })).rejects.toMatchObject({
      field: 'password',
    });
    expect(await accounts.findByEmail('owner@shop.com')).toBeNull();
  });

  it('accepts a password of exactly 8 characters', async () => {
    const { registerAccount } = setup();

    await expect(
      registerAccount.execute({ ...input, password: '12345678' }),
    ).resolves.toBeDefined();
  });

  it('accepts exactly 72 UTF-8 bytes and rejects 73 (bcrypt truncates beyond 72)', async () => {
    const { registerAccount } = setup();

    await expect(
      registerAccount.execute({ ...input, password: 'a'.repeat(72) }),
    ).resolves.toBeDefined();
    await expect(
      registerAccount.execute({ ...input, email: 'other@shop.com', password: 'a'.repeat(73) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('counts bytes, not characters, for the maximum length', async () => {
    const { registerAccount } = setup();
    // 37 two-byte characters = 74 bytes but only 37 characters.
    const password = 'ñ'.repeat(37);

    await expect(registerAccount.execute({ ...input, password })).rejects.toMatchObject({
      field: 'password',
    });
  });

  it('reports an invalid email as a validation error', async () => {
    const { registerAccount } = setup();

    await expect(registerAccount.execute({ ...input, email: 'nope' })).rejects.toMatchObject({
      field: 'email',
    });
  });
});
