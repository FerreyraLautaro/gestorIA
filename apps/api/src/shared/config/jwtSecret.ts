export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates the JWT_SECRET environment value used to sign access tokens.
 * Required and at least 32 characters; the error never echoes the value.
 */
export function parseJwtSecret(raw: string | undefined): string {
  if (!raw || raw.trim().length === 0) {
    throw new Error('JWT_SECRET is required: set a random secret in apps/api/.env.');
  }
  if (raw.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`Invalid JWT_SECRET: it must be at least ${MIN_JWT_SECRET_LENGTH} characters.`);
  }
  return raw;
}
