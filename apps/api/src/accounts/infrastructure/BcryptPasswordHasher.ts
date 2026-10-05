import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../domain/PasswordHasher.js';

/** bcrypt work factor used in production; tests inject a lower one (minimum 4). */
export const DEFAULT_BCRYPT_COST = 12;

/** bcrypt hasher backed by `bcryptjs` (pure JavaScript, so no native build step). */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cost: number = DEFAULT_BCRYPT_COST) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }
}
