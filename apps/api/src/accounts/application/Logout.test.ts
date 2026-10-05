import { describe, expect, it } from 'vitest';
import { FakeRefreshTokenGenerator } from '../infrastructure/testing/FakeRefreshTokenGenerator.js';
import { InMemoryRefreshTokenRepository } from '../infrastructure/testing/InMemoryRefreshTokenRepository.js';
import { Logout } from './Logout.js';
import { RefreshTokenIssuer } from './RefreshTokenIssuer.js';

async function setup() {
  const now = new Date('2026-06-01T12:00:00.000Z');
  const repository = new InMemoryRefreshTokenRepository();
  const generator = new FakeRefreshTokenGenerator();
  const issued = new RefreshTokenIssuer(generator, () => now).issue('account-1');
  await repository.insert(issued.token);
  return { now, repository, generator, issued, logout: new Logout(repository, generator, () => now) };
}

describe('Logout', () => {
  it('revokes the presented token', async () => {
    const { now, repository, issued, logout } = await setup();

    await logout.execute(issued.raw);

    expect((await repository.findByHash(issued.token.tokenHash))?.revokedAt).toEqual(now);
  });

  it('is idempotent for repeated, unknown and missing tokens', async () => {
    const { logout, issued } = await setup();

    await logout.execute(issued.raw);
    await expect(logout.execute(issued.raw)).resolves.toBeUndefined();
    await expect(logout.execute('never-issued')).resolves.toBeUndefined();
    await expect(logout.execute(undefined)).resolves.toBeUndefined();
  });

  it('keeps the original revocation time when revoking twice', async () => {
    const { repository, issued, generator } = await setup();
    const firstLogout = new Date('2026-06-01T13:00:00.000Z');
    await new Logout(repository, generator, () => firstLogout).execute(issued.raw);

    await new Logout(repository, generator, () => new Date('2026-06-02T00:00:00.000Z')).execute(
      issued.raw,
    );

    expect((await repository.findByHash(issued.token.tokenHash))?.revokedAt).toEqual(firstLogout);
  });
});
