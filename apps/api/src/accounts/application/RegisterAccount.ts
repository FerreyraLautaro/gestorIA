import { ConflictError, ValidationError } from '../../shared/domain/errors.js';
import { Account, normalizeEmail } from '../domain/Account.js';
import type { AccountRepository } from '../domain/AccountRepository.js';
import type { PasswordHasher } from '../domain/PasswordHasher.js';

export interface RegisterAccountInput {
  email: string;
  password: string;
  businessName: string;
}

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt only reads the first 72 bytes, so longer passwords would be silently truncated. */
export const MAX_PASSWORD_BYTES = 72;

/** Registers a new account, storing only a hash of the password. */
export class RegisterAccount {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: RegisterAccountInput): Promise<Account> {
    assertPasswordPolicy(input.password);
    // Validate the other fields before spending time on hashing.
    Account.create({
      email: input.email,
      businessName: input.businessName,
      passwordHash: 'pending',
    });

    if (await this.accounts.findByEmail(normalizeEmail(input.email))) {
      throw new ConflictError('email is already registered');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const account = Account.create({
      email: input.email,
      businessName: input.businessName,
      passwordHash,
    });
    // A concurrent registration of the same email surfaces as ConflictError from the repository.
    await this.accounts.save(account);
    return account;
  }
}

function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      'password',
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new ValidationError(
      'password',
      `password must be at most ${MAX_PASSWORD_BYTES} bytes when encoded as UTF-8`,
    );
  }
}
