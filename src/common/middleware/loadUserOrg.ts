/**
 * (user, organization, membership) resolution. The implementation lives in the
 * access library (`@/access`), which owns `ensureAuthContext`/`loadUserOrg` and
 * memoizes the DB context per request. Re-exported here for backward-compatible
 * `@/common/middleware` imports.
 */
export { loadUserOrg, ensureAuthContext } from '@/access';
