import { ConflictError } from '../../../shared/domain/errors.js';
import { Account, normalizeEmail } from '../../domain/Account.js';
import type { AccountRepository } from '../../domain/AccountRepository.js';

/** Test double for the account port with the same semantics as the Drizzle adapter. */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();

  async save(account: Account): Promise<void> {
    const emailTaken = [...this.accounts.values()].some(
      (stored) => stored.email === account.email && stored.id !== account.id,
    );
    if (emailTaken) {
      throw new ConflictError('email is already registered');
    }
    this.accounts.set(account.id, copy(account));
  }

  async findByEmail(email: string): Promise<Account | null> {
    const normalized = normalizeEmail(email);
    const found = [...this.accounts.values()].find((account) => account.email === normalized);
    return found ? copy(found) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const found = this.accounts.get(id);
    return found ? copy(found) : null;
  }
}

function copy(account: Account): Account {
  return Account.restore({ ...account });
}
