import type { Request, RequestHandler } from 'express';
import type { AuthContext, AuthPrincipal } from '@/common/types/context';

export type { AuthContext, AuthPrincipal };

/**
 * Principal attributes derived from an `AuthContext`, consumed by `can()`, the
 * branch-scope resolver, and the policy evaluator. Everything the authorization
 * layer decides on is expressed here — role, ownership, branch assignments.
 */
export interface PrincipalAttrs {
  userId: string;
  organizationId: string;
  isOwner: boolean;
  roleId: string | null;
  branchIds: string[];
}

export type PolicyEffectValue = 'ALLOW' | 'DENY';

/** A stored `Policy` row narrowed to what the evaluator needs. */
export interface PolicyRule {
  effect: PolicyEffectValue;
  action: string; // verb or '*'
  subject: string; // resource type or '*'
  conditions?: unknown | null; // JSON condition matcher (see policy.ts)
  role_id?: string | null; // null = applies to every member of the org
}

/** Machine-readable denial reasons (stable; surfaced in 403 payloads). */
export type DenyReason = 'permission_denied' | 'branch_not_permitted' | 'policy_denied';

export interface Decision {
  allowed: boolean;
  reason?: DenyReason;
}

/** Input to the single authorization seam `can()`. */
export interface CanInput {
  ctx: AuthContext;
  /** RBAC permission code, e.g. `platform.roles.manage`. */
  permission?: string;
  /** ABAC verb (read|create|update|delete|manage). Pair with `subject`. */
  action?: string;
  /** ABAC resource type (Branch|Role|User|Policy|*). Pair with `action`. */
  subject?: string;
  /** The resource under decision — its attributes are matched by policy conditions. */
  resource?: Record<string, unknown> | null;
  /** When set, enforces branch scope (non-owner must have this branch assigned). */
  branchId?: string | null;
}

/** The branches a caller may operate. `allowed = null` = unscoped (owner). */
export interface BranchScope {
  allowed: ReadonlySet<string> | null;
  defaultBranchId: string | null;
}

/** Loads the resource a policy point-check runs against (for `requirePolicy`). */
export type ResourceLoader = (
  req: Request,
  ctx: AuthContext,
) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;

/**
 * The data-access seams the library needs. The app supplies Prisma-backed
 * implementations in `src/access/instance.ts`; another Express app can adopt the
 * library by providing its own. This is what makes `src/access/` portable.
 */
export interface AccessControlDeps {
  loadContext(userId: string, orgId: string | null): Promise<AuthContext>;
  resolvePermissions(roleId: string | null): Promise<string[]>;
  loadPolicies(organizationId: string, roleId: string | null): Promise<PolicyRule[]>;
}

/** The public instance produced by `createAccessControl(deps)`. */
export interface AccessControl {
  ensureAuthContext(req: Request): Promise<AuthContext>;
  loadUserOrg: RequestHandler;
  requirePermission(code: string): RequestHandler;
  requireAnyPermission(...codes: string[]): RequestHandler;
  requirePolicy(action: string, subject: string, loadResource?: ResourceLoader): RequestHandler;
  getBranchScope(req: Request): Promise<BranchScope>;
  can(input: CanInput): Promise<Decision>;
}
