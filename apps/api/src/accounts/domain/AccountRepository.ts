import type { Account } from './Account.js';

/** Persistence port for accounts. */
export interface AccountRepository {
  /**
   * Inserts the account, or updates the stored one with the same id.
   * Throws `ConflictError` when another account already uses the email.
   */
  save(account: Account): Promise<void>;
  /** Looks up by email, ignoring case and surrounding whitespace. Null when not found. */
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
}
