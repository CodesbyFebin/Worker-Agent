import argon2 from "argon2";

/**
 * Hashes a plaintext password using Argon2id.
 * Throws on failure — never returns a plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password, { type: argon2.argon2id });
  } catch (error) {
    throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * Returns false on mismatch or malformed hash; never throws on bad input.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
