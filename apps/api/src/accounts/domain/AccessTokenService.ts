export interface IssuedAccessToken {
  token: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

/** Port for short-lived access tokens that identify an account. */
export interface AccessTokenService {
  issue(accountId: string): Promise<IssuedAccessToken>;
  /** Throws `UnauthorizedError` when the token is invalid, tampered with or expired. */
  verify(token: string): Promise<{ accountId: string }>;
}
