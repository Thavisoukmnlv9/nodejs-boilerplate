import bcrypt from 'bcryptjs';

/**
 * bcrypt via bcryptjs (pure-JS → no native build in Alpine/CI). Hashes are
 * cross-compatible with the reference service's Python `bcrypt` ($2b$), so this
 * service verifies password_hash rows written by the FastAPI service and vice-versa.
 *
 * bcrypt only considers the first 72 bytes; we truncate explicitly (matching the
 * reference) so an over-long password can't smuggle bytes past the limit.
 */
const BCRYPT_COST = 12;

function truncate72(password: string): string {
  const bytes = Buffer.from(password, 'utf-8');
  return bytes.length <= 72 ? password : bytes.subarray(0, 72).toString('utf-8');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_COST);
  return bcrypt.hash(truncate72(password), salt);
}

/** Constant-time verify; never throws (a malformed hash simply fails). */
export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(truncate72(plain), hash);
  } catch {
    return false;
  }
}


