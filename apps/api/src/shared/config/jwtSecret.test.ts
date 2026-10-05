import { describe, expect, it } from 'vitest';
import { MIN_JWT_SECRET_LENGTH, parseJwtSecret } from './jwtSecret.js';

describe('parseJwtSecret', () => {
  it('returns a secret of at least 32 characters', () => {
    const secret = 'x'.repeat(MIN_JWT_SECRET_LENGTH);

    expect(parseJwtSecret(secret)).toBe(secret);
  });

  it.each([undefined, '', '   '])('fails fast when JWT_SECRET is missing or blank (%j)', (raw) => {
    expect(() => parseJwtSecret(raw)).toThrow(/JWT_SECRET is required/);
  });

  it('rejects a secret shorter than 32 characters without echoing it', () => {
    const secret = 'short-secret';

    expect(() => parseJwtSecret(secret)).toThrow(/at least 32 characters/);
    expect(() => parseJwtSecret(secret)).not.toThrow(new RegExp(secret));
  });
});
