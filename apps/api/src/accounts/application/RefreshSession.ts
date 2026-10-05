import { UnauthorizedError } from '../../shared/domain/errors.js';
import type { AccessTokenService } from '../domain/AccessTokenService.js';
import type { RefreshTokenGenerator } from '../domain/RefreshTokenGenerator.js';
import type { RefreshTokenRepository } from '../domain/RefreshTokenRepository.js';
import type { RefreshTokenIssuer } from './RefreshTokenIssuer.js';

export interface RefreshSessionResult {
  accessToken: string;
  /** Lifetime of the access token in seconds. */
  expiresIn: number;
  /** New opaque refresh token; the presented one is no longer valid. */
  refreshToken: string;
}

const INVALID_REFRESH_TOKEN = 'invalid or expired refresh token';

/** Exchanges a refresh token for a new access token, rotating the refresh token. */
export class RefreshSession {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly generator: RefreshTokenGenerator,
    private readonly issuer: RefreshTokenIssuer,
    private readonly accessTokens: AccessTokenService,
    private readonly clock: () => Date,
  ) {}

  async execute(rawToken: string | undefined): Promise<RefreshSessionResult> {
    if (!rawToken) {
      throw new UnauthorizedError(INVALID_REFRESH_TOKEN);
    }
    const presentedHash = this.generator.hash(rawToken);
    const presented = await this.refreshTokens.findByHash(presentedHash);
    const now = this.clock();
    if (!presented || presented.expiresAt <= now) {
      throw new UnauthorizedError(INVALID_REFRESH_TOKEN);
    }
    if (presented.revokedAt !== null) {
      await this.rejectReuse(presented.familyId, now);
    }

    // The claim is a conditional update, so of two concurrent refreshes with the same token
    // only one gets it; the loser looks exactly like a replay of a used token.
    const next = this.issuer.issue(presented.accountId, presented.familyId);
    const claimed = await this.refreshTokens.rotate(presentedHash, next.token, now);
    if (!claimed) {
      await this.rejectReuse(presented.familyId, now);
    }

    const { token, expiresIn } = await this.accessTokens.issue(presented.accountId);
    return { accessToken: token, expiresIn, refreshToken: next.raw };
  }

  /** A used token came back: assume theft and kill every token descended from the same login. */
  private async rejectReuse(familyId: string, now: Date): Promise<never> {
    await this.refreshTokens.revokeFamily(familyId, now);
    throw new UnauthorizedError(INVALID_REFRESH_TOKEN);
  }
}
