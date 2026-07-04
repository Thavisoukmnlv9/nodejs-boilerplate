/**
 * RBAC permission guards. The implementation lives in the access library
 * (`@/access`), which composes the code check with the ABAC policy layer and
 * branch scope. Re-exported here for backward-compatible `@/common/middleware`
 * imports.
 */
export { requirePermission, requireAnyPermission } from '@/access';
