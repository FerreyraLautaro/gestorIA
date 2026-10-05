import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../shared/domain/errors.js';
import type { AccessTokenService } from '../domain/AccessTokenService.js';
import { FakePasswordHasher } from '../infrastructure/testing/FakePasswordHasher.js';
import { FakeRefreshTokenGenerator } from '../infrastructure/testing/FakeRefreshTokenGenerator.js';
import { InMemoryAccountRepository } from '../infrastructure/testing/InMemoryAccountRepository.js';
import { InMemoryRefreshTokenRepository } from '../infrastructure/testing/InMemoryRefreshTokenRepository.js';
import { LoginAccount } from './LoginAccount.js';
import { RefreshTokenIssuer } from './RefreshTokenIssuer.js';
import { RegisterAccount } from './RegisterAccount.js';

const tokens: AccessTokenService = {
  issue: async (accountId) => ({ token: `token-for-${accountId}`, expiresIn: 900 }),
  verify: async () => {
    throw new Error('not used');
  },
};

async function setup() {
  const accounts = new InMemoryAccountRepository();
  const hasher = new FakePasswordHasher();
  const account = await new RegisterAccount(accounts, hasher).execute({
    email: 'owner@shop.com',
    password: 'correct horse',
    businessName: 'Mate Shop',
  });
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const generator = new FakeRefreshTokenGenerator();
  const loginAccount = new LoginAccount(
    accounts,
    hasher,
    tokens,
    refreshTokens,
    new RefreshTokenIssuer(generator, () => new Date('2026-06-01T12:00:00.000Z')),
  );
  return { account, hasher, refreshTokens, generator, loginAccount };
}

describe('LoginAccount', () => {
  it('returns an access token for valid credentials', async () => {
    const { account, loginAccount } = await setup();

    const result = await loginAccount.execute({
      email: ' Owner@Shop.com',
      password: 'correct horse',
    });

    expect(result).toEqual({
      accessToken: `token-for-${account.id}`,
      expiresIn: 900,
      refreshToken: 'raw-1',
    });
  });

  it('starts a new refresh token family on every login and stores only the hash', async () => {
    const { account, refreshTokens, generator, loginAccount } = await setup();
    const credentials = { email: 'owner@shop.com', password: 'correct horse' };

    const first = await loginAccount.execute(credentials);
    const second = await loginAccount.execute(credentials);

    const a = await refreshTokens.findByHash(generator.hash(first.refreshToken));
    const b = await refreshTokens.findByHash(generator.hash(second.refreshToken));
    expect(a).toMatchObject({ accountId: account.id, revokedAt: null });
    expect(b).toMatchObject({ accountId: account.id, revokedAt: null });
    expect(a?.familyId).not.toBe(b?.familyId);
    expect(await refreshTokens.findByHash(first.refreshToken)).toBeNull();
  });

  it('issues no refresh token when the credentials are wrong', async () => {
    const { refreshTokens, generator, loginAccount } = await setup();

    await loginAccount
      .execute({ email: 'owner@shop.com', password: 'wrong password' })
      .catch(() => undefined);

    expect(await refreshTokens.findByHash(generator.hash('raw-1'))).toBeNull();
  });

  it('rejects a wrong password', async () => {
    const { loginAccount } = await setup();

    await expect(
      loginAccount.execute({ email: 'owner@shop.com', password: 'wrong password' }),
    ).rejects.toThrow(new UnauthorizedError('invalid email or password'));
  });

  it('rejects an unknown email with the exact same error as a wrong password', async () => {
    const { loginAccount } = await setup();

    const unknown = await loginAccount
      .execute({ email: 'nobody@shop.com', password: 'whatever pass' })
      .catch((error: unknown) => error);
    const wrong = await loginAccount
      .execute({ email: 'owner@shop.com', password: 'wrong password' })
      .catch((error: unknown) => error);

    expect(unknown).toBeInstanceOf(UnauthorizedError);
    expect(wrong).toBeInstanceOf(UnauthorizedError);
    expect((unknown as UnauthorizedError).message).toBe((wrong as UnauthorizedError).message);
    expect((unknown as UnauthorizedError).code).toBe((wrong as UnauthorizedError).code);
  });

  it('still verifies against a dummy hash when the email is unknown (no timing oracle)', async () => {
    const { hasher, loginAccount } = await setup();
    hasher.verifiedHashes.length = 0;

    await loginAccount
      .execute({ email: 'nobody@shop.com', password: 'whatever pass' })
      .catch(() => undefined);

    expect(hasher.verifiedHashes).toHaveLength(1);
  });

  it('treats a malformed email like any unknown email', async () => {
    const { loginAccount } = await setup();

    await expect(
      loginAccount.execute({ email: 'not-an-email', password: 'whatever pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
