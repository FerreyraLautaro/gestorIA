import type { PasswordHasher } from '../../domain/PasswordHasher.js';

/** Instant, deterministic hasher for use case tests; records every verification. */
export class FakePasswordHasher implements PasswordHasher {
  readonly verifiedHashes: string[] = [];

  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    this.verifiedHashes.push(hash);
    return hash === `hashed:${password}`;
  }
}
