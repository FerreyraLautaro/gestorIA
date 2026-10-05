import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../shared/domain/errors.js';

export interface CreateAccountProps {
  email: string;
  /** Output of a `PasswordHasher`; an account never holds a plain password. */
  passwordHash: string;
  businessName: string;
}

/** Full state of a persisted account, used to rebuild it without re-running creation rules. */
export interface AccountState {
  id: string;
  email: string;
  passwordHash: string;
  businessName: string;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_EMAIL_LENGTH = 254;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Canonical form used to store and look up emails: trimmed and lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class Account {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly businessName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(state: AccountState) {
    this.id = state.id;
    this.email = state.email;
    this.passwordHash = state.passwordHash;
    this.businessName = state.businessName;
    this.createdAt = state.createdAt;
    this.updatedAt = state.updatedAt;
  }

  /** Rebuilds an account from trusted persisted state (e.g. a repository row). */
  static restore(state: AccountState): Account {
    return new Account({
      ...state,
      createdAt: new Date(state.createdAt.getTime()),
      updatedAt: new Date(state.updatedAt.getTime()),
    });
  }

  static create(props: CreateAccountProps): Account {
    const email = requireEmail(props.email);
    const businessName = requireNonBlank(props.businessName, 'businessName');
    const passwordHash = requireNonBlank(props.passwordHash, 'passwordHash');
    const now = new Date();

    return new Account({
      id: randomUUID(),
      email,
      passwordHash,
      businessName,
      createdAt: now,
      updatedAt: new Date(now.getTime()),
    });
  }
}

function requireEmail(value: string): string {
  const email = normalizeEmail(value);
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_FORMAT.test(email)) {
    throw new ValidationError('email', 'email must be a valid email address');
  }
  return email;
}

function requireNonBlank(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(field, `${field} must not be blank`);
  }
  return trimmed;
}
