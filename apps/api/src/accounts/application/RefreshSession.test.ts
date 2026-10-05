import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../shared/domain/errors.js';
import type { AccessTokenService } from '../domain/AccessTokenService.js';
import { REFRESH_TOKEN_TTL_SECONDS } from '../domain/RefreshToken.js';
import { FakeRefreshTokenGenerator } from '../infrastructure/testing/FakeRefreshTokenGenerator.js';
import { InMemoryRefreshTokenRepository } from '../infrastructure/testing/InMemoryRefreshTokenRepository.js';
import { RefreshSession } from './RefreshSession.js';
import { RefreshTokenIssuer } from './RefreshTokenIssuer.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const accessTokens: AccessTokenService = {
  issue: async (accountId) => ({ token: `access-for-${accountId}`, expiresIn: 900 }),
  verify: async () => {
    throw new Error('not used');
  },
};

async function setup() {
  const clock = { now: new Date('2026-06-01T12:00:00.000Z') };
  const repository = new InMemoryRefreshTokenRepository();
  const generator = new FakeRefreshTokenGenerator();
  const issuer = new RefreshTokenIssuer(generator, () => clock.now);
  const refreshSession = new RefreshSession(
    repository,
    generator,
    issuer,
    accessTokens,
    () => clock.now,
  );

  // What login does: start a new family.
  const first = issuer.issue('account-1');
  await repository.insert(first.token);

  return { clock, repository, generator, issuer, refreshSession, first };
}

describe('RefreshSession', () => {
  it('rotates: revokes the presented token and issues a new one in the same family', async () => {
    const { clock, repository, generator, refreshSession, first } = await setup();

    const result = await refreshSession.execute(first.raw);

    expect(result).toEqual({
      accessToken: 'access-for-account-1',
      expiresIn: 900,
      refreshToken: 'raw-2',
    });
    const old = await repository.findByHash(generator.hash(first.raw));
    expect(old?.revokedAt).toEqual(clock.now);
    const next = await repository.findByHash(generator.hash('raw-2'));
    expect(next).toMatchObject({
      accountId: 'account-1',
      familyId: first.token.familyId,
      revokedAt: null,
    });
    expect(next?.id).not.toBe(first.token.id);
  });

  it('stores only the hash of the new token, never its raw value', async () => {
    const { repository, refreshSession, first } = await setup();

    const { refreshToken } = await refreshSession.execute(first.raw);

    expect(await repository.findByHash(refreshToken)).toBeNull();
  });

  it('slides the expiry: the new token is valid 7 days from the refresh moment', async () => {
    const { clock, repository, generator, refreshSession, first } = await setup();
    clock.now = new Date(clock.now.getTime() + 3 * DAY_MS);

    const { refreshToken } = await refreshSession.execute(first.raw);

    const next = await repository.findByHash(generator.hash(refreshToken));
    expect(next?.expiresAt).toEqual(
      new Date(clock.now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    );
  });

  it.each([undefined, ''])('rejects a missing token (%j)', async (missing) => {
    const { refreshSession } = await setup();

    await expect(refreshSession.execute(missing)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an unknown token', async () => {
    const { refreshSession } = await setup();

    await expect(refreshSession.execute('never-issued')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an expired token', async () => {
    const { clock, refreshSession, first } = await setup();
    clock.now = new Date(first.token.expiresAt.getTime());

    await expect(refreshSession.execute(first.raw)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('detects reuse: a revoked token revokes the whole family, including the newest token', async () => {
    const { repository, generator, refreshSession, first } = await setup();
    const { refreshToken: newest } = await refreshSession.execute(first.raw);

    await expect(refreshSession.execute(first.raw)).rejects.toBeInstanceOf(UnauthorizedError);

    expect((await repository.findByHash(generator.hash(newest)))?.revokedAt).not.toBeNull();
    await expect(refreshSession.execute(newest)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('leaves other families untouched when reuse is detected', async () => {
    const { repository, issuer, refreshSession, first } = await setup();
    const other = issuer.issue('account-1');
    await repository.insert(other.token);
    await refreshSession.execute(first.raw);

    await refreshSession.execute(first.raw).catch(() => undefined);

    expect((await repository.findByHash(other.token.tokenHash))?.revokedAt).toBeNull();
  });

  it('lets only one of two concurrent refreshes with the same token succeed and revokes the family', async () => {
    const { repository, generator, refreshSession, first } = await setup();

    const results = await Promise.allSettled([
      refreshSession.execute(first.raw),
      refreshSession.execute(first.raw),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedError);
    const winner = (fulfilled[0] as PromiseFulfilledResult<{ refreshToken: string }>).value;
    const stored = await repository.findByHash(generator.hash(winner.refreshToken));
    expect(stored?.revokedAt).not.toBeNull();
  });
});
