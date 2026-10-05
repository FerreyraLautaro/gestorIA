export interface GeneratedRefreshToken {
  /** Opaque value for the client; never stored. */
  raw: string;
  /** Deterministic hash of `raw`; the only form that is persisted and looked up. */
  hash: string;
}

/** Port that creates opaque refresh token values and hashes presented ones. */
export interface RefreshTokenGenerator {
  generate(): GeneratedRefreshToken;
  hash(raw: string): string;
}
