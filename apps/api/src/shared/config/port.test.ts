import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, parsePort } from './port.js';

describe('parsePort', () => {
  it('returns the default port when PORT is not set', () => {
    expect(parsePort(undefined)).toBe(DEFAULT_PORT);
  });

  it('returns the default port when PORT is empty or blank', () => {
    expect(parsePort('')).toBe(DEFAULT_PORT);
    expect(parsePort('   ')).toBe(DEFAULT_PORT);
  });

  it('parses a valid port number', () => {
    expect(parsePort('8080')).toBe(8080);
    expect(parsePort(' 4000 ')).toBe(4000);
  });

  it.each(['abc', '30a0', '3000.5', '-1', '0', '65536'])(
    'rejects invalid value %j with a clear error',
    (raw) => {
      expect(() => parsePort(raw)).toThrow(/Invalid PORT/);
    },
  );
});
