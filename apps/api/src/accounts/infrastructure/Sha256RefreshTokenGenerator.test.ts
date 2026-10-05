import { describe, expect, it } from 'vitest';
import { Sha256RefreshTokenGenerator } from './Sha256RefreshTokenGenerator.js';

describe('Sha256RefreshTokenGenerator', () => {
  const generator = new Sha256RefreshTokenGenerator();

  it('generates a 256-bit base64url value and its SHA-256 hex hash', () => {
    const { raw, hash } = generator.generate();

    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.hash(raw)).toBe(hash);
  });

  it('never repeats a value', () => {
    const values = new Set(Array.from({ length: 50 }, () => generator.generate().raw));

    expect(values.size).toBe(50);
  });

  it('matches the known SHA-256 vector for "abc"', () => {
    expect(generator.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
