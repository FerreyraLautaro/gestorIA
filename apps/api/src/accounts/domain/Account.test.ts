import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../shared/domain/errors.js';
import { Account, normalizeEmail } from './Account.js';

const valid = { email: 'owner@shop.com', passwordHash: '$2b$12$hash', businessName: 'Mate Shop' };

describe('Account.create', () => {
  it('creates an account with a generated id and equal timestamps', () => {
    const account = Account.create(valid);

    expect(account.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(account.email).toBe('owner@shop.com');
    expect(account.passwordHash).toBe('$2b$12$hash');
    expect(account.businessName).toBe('Mate Shop');
    expect(account.createdAt).toBeInstanceOf(Date);
    expect(account.updatedAt).toEqual(account.createdAt);
  });

  it('trims and lowercases the email and trims the business name', () => {
    const account = Account.create({
      ...valid,
      email: '  Owner@Shop.COM ',
      businessName: ' Mate ',
    });

    expect(account.email).toBe('owner@shop.com');
    expect(account.businessName).toBe('Mate');
  });

  it.each(['', '   ', 'no-at-sign', 'a@b', '@shop.com', 'a b@shop.com', 'a@@shop.com'])(
    'rejects invalid email %j',
    (email) => {
      expect(() => Account.create({ ...valid, email })).toThrow(ValidationError);
      expect(() => Account.create({ ...valid, email })).toThrow(/email/);
    },
  );

  it('rejects an email longer than 254 characters', () => {
    const email = `${'a'.repeat(250)}@shop.com`;

    expect(() => Account.create({ ...valid, email })).toThrow(/email/);
  });

  it('rejects a blank business name', () => {
    expect(() => Account.create({ ...valid, businessName: '   ' })).toThrow(/businessName/);
  });

  it('rejects a blank password hash', () => {
    expect(() => Account.create({ ...valid, passwordHash: '' })).toThrow(/passwordHash/);
  });
});

describe('Account.restore', () => {
  it('rebuilds the stored state without re-running creation rules', () => {
    const state = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'owner@shop.com',
      passwordHash: 'stored-hash',
      businessName: 'Mate Shop',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    const account = Account.restore(state);

    expect({ ...account }).toEqual(state);
    expect(account.createdAt).not.toBe(state.createdAt);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  A@B.Com ')).toBe('a@b.com');
  });
});
