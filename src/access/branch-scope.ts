import { ForbiddenError } from '@/common/errors';
import type { AuthContext, BranchScope } from './types';

/**
 * Branch scope (a built-in ABAC dimension). Resolved LIVE from the membership row
 * every request — never from the JWT, which would go stale when a member's branch
 * assignment changes mid-session. Owners are unscoped (`allowed = null`).
 *
 * Port of the FastAPI reference `app/core/security/branch_scope.py`.
 */

export function branchIdsOf(membership: AuthContext['membership']): string[] {
  return (membership.branch_access ?? []).map((a) => a.branch_id);
}

export function branchScopeFromMembership(membership: AuthContext['membership']): BranchScope {
  const defaultBranchId = membership.default_branch_id ?? null;
  if (membership.is_owner) return { allowed: null, defaultBranchId };
  return { allowed: new Set(branchIdsOf(membership)), defaultBranchId };
}

/**
 * Resolve the Prisma filter value for the caller's branch scope. Use it as
 * `where.branch_id` (or `where.id` on the Branch list itself).
 *
 *   • owner (unscoped)          → the requested id, or `undefined` (no filter)
 *   • scoped + requested in set → the requested id
 *   • scoped + requested ∉ set  → 403 `branch_not_permitted`
 *   • scoped + no request       → `{ in: [...assigned] }` (clamped)
 *
 * Recipe for a scoped list endpoint (copy this into any tenant-branch module):
 *   const scope = await accessControl.getBranchScope(req);
 *   const branchWhere = resolveBranchWhere(req.query.branch_id as string | undefined, scope);
 *   const rows = await repo.list({ organization_id: org.id, ...(branchWhere ? { branch_id: branchWhere } : {}) });
 */
export function resolveBranchWhere(
  requestedBranchId: string | undefined,
  scope: BranchScope,
): string | { in: string[] } | undefined {
  if (scope.allowed === null) return requestedBranchId ?? undefined;
  if (requestedBranchId) {
    if (!scope.allowed.has(requestedBranchId)) {
      throw new ForbiddenError('You are not permitted to operate this branch.', {
        error: 'branch_not_permitted',
        branch_id: requestedBranchId,
      });
    }
    return requestedBranchId;
  }
  return { in: [...scope.allowed] };
}
