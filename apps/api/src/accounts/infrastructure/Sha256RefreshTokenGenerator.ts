import { createHash, randomBytes } from 'node:crypto';
import type {
  GeneratedRefreshToken,
  RefreshTokenGenerator,
} from '../domain/RefreshTokenGenerator.js';

const TOKEN_BYTES = 32;

/**
 * Opaque refresh tokens: 32 random bytes as base64url, stored only as a SHA-256 hex digest.
 * SHA-256 (not bcrypt) is enough because the value is high-entropy random, so it cannot be
 * guessed or brute-forced the way a password can, and a fast deterministic hash lets the
 * database look the token up by its hash with a unique index.
 */
export class Sha256RefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): GeneratedRefreshToken {
    const raw = randomBytes(TOKEN_BYTES).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
