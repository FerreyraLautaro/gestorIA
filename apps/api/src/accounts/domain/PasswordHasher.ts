/** Port for one-way password hashing. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Resolves false (never throws) when the password does not match or the hash is malformed. */
  verify(password: string, hash: string): Promise<boolean>;
}
