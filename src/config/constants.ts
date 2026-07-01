/** Cross-cutting constants. Import these instead of sprinkling magic strings. */

export const API_PREFIX = '/api/v1';

/** JWT `type` claim discriminators — a token minted for one purpose can never be
 *  replayed as another. Values are wire-compatible with the FastAPI reference. */
export const TokenType = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET: 'reset',
  MANAGER_PIN: 'manager_pin',
} as const;
export type TokenType = (typeof TokenType)[keyof typeof TokenType];

/** Short-lived POS elevation token TTL (minutes) — fixed, per the reference. */
export const MANAGER_PIN_TTL_MINUTES = 5;

/** User.status values (String column, not a Prisma enum in the shared schema). */
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

/** OrganizationSubscription.status values that grant entitlements. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING'] as const;
