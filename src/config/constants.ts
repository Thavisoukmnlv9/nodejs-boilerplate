/** Cross-cutting constants. Import these instead of sprinkling magic strings. */

export const API_PREFIX = '/api/v1';

/** JWT `type` claim discriminators — a token minted for one purpose can never be
 *  replayed as another. Values are wire-compatible with the FastAPI reference. */
export const TokenType = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET: 'reset',
} as const;
export type TokenType = (typeof TokenType)[keyof typeof TokenType];

/** User.status values (String column, not a Prisma enum in the shared schema). */
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
