/**
 * Base class for errors raised by domain rules.
 * Free of transport concepts: adapters map `code` to their own representation.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when input data violates a domain invariant for a specific field. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

/** Raised when a resource does not exist or is not visible to the caller. */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`${resource} ${id} was not found`);
  }
}

/** Raised when an operation conflicts with existing state, e.g. a duplicate unique value. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

/** Raised when the caller is not authenticated or presented invalid credentials. */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'authentication required') {
    super(message);
  }
}
