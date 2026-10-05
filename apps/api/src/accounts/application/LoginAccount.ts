import { UnauthorizedError } from '../../shared/domain/errors.js';
import { normalizeEmail } from '../domain/Account.js';
import type { AccessTokenService } from '../domain/AccessTokenService.js';
import type { AccountRepository } from '../domain/AccountRepository.js';
import type { PasswordHasher } from '../domain/PasswordHasher.js';

export interface LoginAccountInput {
  email: string;
  password: string;
}

export interface LoginAccountResult {
  accessToken: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

const INVALID_CREDENTIALS = 'invalid email or password';

/** Authenticates an email and password and issues an access token. */
export class LoginAccount {
  /**
   * Hash verified when the email is unknown, so unknown and known emails cost the same.
   * Created through the injected hasher (same algorithm and cost as real hashes) on first use.
   */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AccessTokenService,
  ) {}

  async execute(input: LoginAccountInput): Promise<LoginAccountResult> {
    const account = await this.accounts.findByEmail(normalizeEmail(input.email));

    // Always run one verification: skipping it for unknown emails would leak, through
    // response time, which emails are registered. Both failures share one error.
    const hash = account ? account.passwordHash : await this.getDummyHash();
    const matches = await this.hasher.verify(input.password, hash);
    if (!account || !matches) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const { token, expiresIn } = await this.tokens.issue(account.id);
    return { accessToken: token, expiresIn };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('gestoria-dummy-password');
    return this.dummyHash;
  }
}
