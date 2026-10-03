export const DEFAULT_PORT = 3000;

const MAX_PORT = 65535;

/**
 * Parses the PORT environment value.
 * Unset or blank falls back to DEFAULT_PORT; anything else must be an integer in 1..65535.
 */
export function parsePort(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`Invalid PORT "${raw}": expected an integer between 1 and ${MAX_PORT}.`);
  }

  return port;
}
