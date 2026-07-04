/**
 * Access-control library — the single public surface for authentication, RBAC,
 * branch scope, and the ABAC policy layer. App code imports from `@/access`, never
 * a deep path. See ./README.md for the adoption recipe.
 */

// Types
export type {
  AccessControl,
  AccessControlDeps,
  AuthContext,
  AuthPrincipal,
  BranchScope,
  CanInput,
  Decision,
  DenyReason,
  PolicyEffectValue,
  PolicyRule,
  PrincipalAttrs,
  ResourceLoader,
} from './types';

// Pure mechanics (portable, no app deps)
export { authGuard, bearerToken } from './guards';
export { branchIdsOf, branchScopeFromMembership, resolveBranchWhere } from './branch-scope';
export { evaluatePolicies, matchConditions, type PolicyEvalContext, type PolicyOutcome } from './policy';
export {
  definePermissionCatalog,
  humanize,
  moduleActionCodes,
  permissionSeedsFromCodes,
  type CatalogInput,
  type PermissionCatalog,
  type PermissionSeed,
  type RoleSeed,
} from './catalog';
export {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  generateOpaqueToken,
  hashOpaqueToken,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type ResetTokenPayload,
} from './tokens';
export { createAccessControl } from './create-access-control';

// The wired app instance (Prisma-backed)
export {
  accessControl,
  ensureAuthContext,
  loadUserOrg,
  requirePermission,
  requireAnyPermission,
  requirePolicy,
  getBranchScope,
  can,
} from './instance';
