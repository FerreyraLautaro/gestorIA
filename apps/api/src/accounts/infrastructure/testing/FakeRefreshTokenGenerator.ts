import type {
  GeneratedRefreshToken,
  RefreshTokenGenerator,
} from '../../domain/RefreshTokenGenerator.js';

/** Deterministic generator for use case tests: `raw-1`, `raw-2`, ... hashed as `hash:<raw>`. */
export class FakeRefreshTokenGenerator implements RefreshTokenGenerator {
  private counter = 0;

  generate(): GeneratedRefreshToken {
    this.counter += 1;
    const raw = `raw-${this.counter}`;
    return { raw, hash: this.hash(raw) };
  }

  hash(raw: string): string {
    return `hash:${raw}`;
  }
}
