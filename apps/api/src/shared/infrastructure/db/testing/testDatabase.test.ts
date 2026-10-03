import { describe, expect, it } from 'vitest';
import { deriveTestDatabaseUrl } from './testDatabase.js';

describe('deriveTestDatabaseUrl', () => {
  it('appends _test to the database name and keeps the rest of the URL', () => {
    expect(deriveTestDatabaseUrl('postgresql://user:secret@localhost:5432/gestoria')).toBe(
      'postgresql://user:secret@localhost:5432/gestoria_test',
    );
  });

  it('preserves query parameters', () => {
    expect(
      deriveTestDatabaseUrl('postgresql://user:secret@localhost:5432/gestoria?sslmode=disable'),
    ).toBe('postgresql://user:secret@localhost:5432/gestoria_test?sslmode=disable');
  });

  it('does not append the suffix twice', () => {
    expect(deriveTestDatabaseUrl('postgresql://user@localhost/gestoria_test')).toBe(
      'postgresql://user@localhost/gestoria_test',
    );
  });

  it('rejects a URL without a database name', () => {
    expect(() => deriveTestDatabaseUrl('postgresql://user@localhost:5432/')).toThrow(
      /database name/,
    );
  });
});
