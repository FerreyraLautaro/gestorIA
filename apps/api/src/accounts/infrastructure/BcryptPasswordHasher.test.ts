import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from './BcryptPasswordHasher.js';

// Cost 4 is the bcrypt minimum: keeps the unit suite fast.
const hasher = new BcryptPasswordHasher(4);

describe('BcryptPasswordHasher', () => {
  it('produces a salted bcrypt hash that never contains the password', async () => {
    const first = await hasher.hash('correct horse');
    const second = await hasher.hash('correct horse');

    expect(first).toMatch(/^\$2[aby]\$04\$/);
    expect(first).not.toContain('correct horse');
    expect(first).not.toBe(second);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash('correct horse');

    expect(await hasher.verify('correct horse', hash)).toBe(true);
    expect(await hasher.verify('wrong horse', hash)).toBe(false);
  });

  it('returns false for a malformed stored hash', async () => {
    expect(await hasher.verify('correct horse', 'not-a-bcrypt-hash')).toBe(false);
  });

  it('uses cost 12 by default', async () => {
    const hash = await new BcryptPasswordHasher().hash('12345678');

    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });
});
