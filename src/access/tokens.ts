/**
 * Token crypto surface for the access library. The implementation currently lives
 * in `@/common/utils/token` (HS256 JWTs, wire-compatible with the reference); this
 * barrel re-exports it so library consumers depend on `@/access`, not a deep path.
 * Move the implementation here if/when the library is extracted to its own package.
 */
export {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type ResetTokenPayload,
} from '@/common/utils/token';

import { randomBytes } from 'node:crypto';
import { sha256Hex } from '@/common/utils/hash';

/**
 * Single-use invite/verification token: an opaque random string handed to the
 * recipient once; only its sha256 hash is persisted (`invitation_token_hash`).
 * Not a JWT — it carries no claims and is validated by hash lookup + expiry.
 */
export function generateOpaqueToken(bytes = 32): { token: string; hash: string } {
  const token = randomBytes(bytes).toString('base64url');
  return { token, hash: sha256Hex(token) };
}

export function hashOpaqueToken(token: string): string {
  return sha256Hex(token);
}
