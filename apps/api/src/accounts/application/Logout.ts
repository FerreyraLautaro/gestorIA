import type { RefreshTokenGenerator } from '../domain/RefreshTokenGenerator.js';
import type { RefreshTokenRepository } from '../domain/RefreshTokenRepository.js';

/** Ends a session by revoking the presented refresh token; idempotent by design. */
export class Logout {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly generator: RefreshTokenGenerator,
    private readonly clock: () => Date,
  ) {}

  /** A missing, unknown or already revoked token still succeeds: the goal state is reached. */
  async execute(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await this.refreshTokens.revoke(this.generator.hash(rawToken), this.clock());
  }
}
