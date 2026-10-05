import { eq } from 'drizzle-orm';
import { ConflictError } from '../../shared/domain/errors.js';
import type { DrizzleDb } from '../../shared/infrastructure/db/database.js';
import { Account, normalizeEmail } from '../domain/Account.js';
import type { AccountRepository } from '../domain/AccountRepository.js';
import { accounts, type AccountRow } from './accounts.schema.js';

const UNIQUE_VIOLATION = '23505';

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: DrizzleDb) {}

  async save(account: Account): Promise<void> {
    const row = toRow(account);
    // Identity is immutable: an update never rewrites id or createdAt.
    const { id: _id, createdAt: _createdAt, ...changes } = row;
    try {
      await this.db
        .insert(accounts)
        .values(row)
        .onConflictDoUpdate({ target: accounts.id, set: changes });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('email is already registered');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, normalizeEmail(email)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return row ? toDomain(row) : null;
  }
}

/** Drizzle wraps driver errors, so the SQLSTATE can sit on `error` or on `error.cause`. */
function isUniqueViolation(error: unknown): boolean {
  const code = (candidate: unknown) =>
    typeof candidate === 'object' && candidate !== null
      ? (candidate as { code?: unknown }).code
      : undefined;
  const cause = typeof error === 'object' && error !== null ? (error as Error).cause : undefined;
  return code(error) === UNIQUE_VIOLATION || code(cause) === UNIQUE_VIOLATION;
}

function toRow(account: Account): AccountRow {
  return {
    id: account.id,
    email: account.email,
    passwordHash: account.passwordHash,
    businessName: account.businessName,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function toDomain(row: AccountRow): Account {
  return Account.restore({ ...row });
}
