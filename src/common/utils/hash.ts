import { createHash } from 'node:crypto';

/** SHA-256 hex digest — used to bind a Session row to its refresh token. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
