import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors.js';

describe('ValidationError', () => {
  it('is a domain error carrying the offending field', () => {
    const error = new ValidationError('price', 'price must be an integer');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.field).toBe('price');
    expect(error.name).toBe('ValidationError');
  });
});

describe('NotFoundError', () => {
  it('is a domain error carrying the missing resource and id', () => {
    const error = new NotFoundError('product', 'abc-123');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.resource).toBe('product');
    expect(error.id).toBe('abc-123');
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('product abc-123 was not found');
  });
});

describe('ConflictError', () => {
  it('is a domain error for state conflicts such as duplicates', () => {
    const error = new ConflictError('email is already registered');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('CONFLICT');
    expect(error.name).toBe('ConflictError');
    expect(error.message).toBe('email is already registered');
  });
});

describe('UnauthorizedError', () => {
  it('is a domain error for failed authentication', () => {
    const error = new UnauthorizedError('invalid email or password');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.name).toBe('UnauthorizedError');
    expect(error.message).toBe('invalid email or password');
  });
});
