import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ForbiddenError, UnauthorizedError } from '@/common/errors';
import type {
  AccessControl,
  AccessControlDeps,
  AuthContext,
  BranchScope,
  CanInput,
  Decision,
  PolicyRule,
  PrincipalAttrs,
  ResourceLoader,
} from './types';
import { branchIdsOf, branchScopeFromMembership } from './branch-scope';
import { evaluatePolicies } from './policy';

/**
 * Builds the access-control instance from injected data-access deps. The returned
 * guards compose `authGuard → requirePermission | requirePolicy` on routes; `can()`
 * is the single decision seam services call. Per-request results (context,
 * permissions, policies) are memoized on the Express `req` so a chain of guards on
 * one route hits the DB once.
 */
export function createAccessControl(deps: AccessControlDeps): AccessControl {
  const permsCache = new WeakMap<Request, Promise<string[]>>();
  const policyCache = new WeakMap<Request, Promise<PolicyRule[]>>();

  async function ensureAuthContext(req: Request): Promise<AuthContext> {
    if (req.authContext) return req.authContext;
    if (!req.auth) throw new UnauthorizedError('Not authenticated');
    const ctx = await deps.loadContext(req.auth.userId, req.auth.orgId);
    req.authContext = ctx;
    return ctx;
  }

  const loadUserOrg: RequestHandler = asyncHandler(async (req, _res, next) => {
    await ensureAuthContext(req);
    next();
  });

  function toPrincipal(ctx: AuthContext): PrincipalAttrs {
    return {
      userId: ctx.user.id,
      organizationId: ctx.organization.id,
      isOwner: ctx.membership.is_owner,
      roleId: ctx.membership.role_id ?? null,
      branchIds: branchIdsOf(ctx.membership),
    };
  }

  /**
   * The decision. Order: (1) stored policies — DENY wins, ALLOW can grant;
   * (2) branch scope — non-owner must have the branch; (3) RBAC — owner or the
   * role holds the code. Owners bypass RBAC + branch scope but NOT an explicit DENY.
   */
  function decide(input: CanInput, perms: string[], policies: PolicyRule[]): Decision {
    const principal = toPrincipal(input.ctx);

    let policyAllows = false;
    if (input.action && input.subject) {
      const outcome = evaluatePolicies(policies, input.action, input.subject, {
        principal,
        resource: input.resource ?? null,
      });
      if (outcome.allowed === false) return { allowed: false, reason: 'policy_denied' };
      policyAllows = outcome.allowed === true;
    }

    if (input.branchId && !principal.isOwner && !principal.branchIds.includes(input.branchId)) {
      return { allowed: false, reason: 'branch_not_permitted' };
    }

    let rbacAllows = true;
    if (input.permission) rbacAllows = principal.isOwner || perms.includes(input.permission);

    if (rbacAllows || policyAllows) return { allowed: true };
    return { allowed: false, reason: 'permission_denied' };
  }

  function permsFor(req: Request, roleId: string | null): Promise<string[]> {
    let p = permsCache.get(req);
    if (!p) {
      p = deps.resolvePermissions(roleId);
      permsCache.set(req, p);
    }
    return p;
  }

  function policiesFor(req: Request, orgId: string, roleId: string | null): Promise<PolicyRule[]> {
    let p = policyCache.get(req);
    if (!p) {
      p = deps.loadPolicies(orgId, roleId);
      policyCache.set(req, p);
    }
    return p;
  }

  async function evaluateReq(req: Request, input: Omit<CanInput, 'ctx'>): Promise<Decision> {
    const ctx = await ensureAuthContext(req);
    const roleId = ctx.membership.role_id ?? null;
    const [perms, policies] = await Promise.all([
      permsFor(req, roleId),
      policiesFor(req, ctx.organization.id, roleId),
    ]);
    return decide({ ctx, ...input }, perms, policies);
  }

  /** Public seam — callable from a service with just a context (no req cache). */
  async function can(input: CanInput): Promise<Decision> {
    const roleId = input.ctx.membership.role_id ?? null;
    const needsPolicies = Boolean(input.action && input.subject);
    const [perms, policies] = await Promise.all([
      input.permission ? deps.resolvePermissions(roleId) : Promise.resolve<string[]>([]),
      needsPolicies ? deps.loadPolicies(input.ctx.organization.id, roleId) : Promise.resolve<PolicyRule[]>([]),
    ]);
    return decide(input, perms, policies);
  }

  function requirePermission(code: string): RequestHandler {
    return asyncHandler(async (req, _res, next) => {
      const decision = await evaluateReq(req, { permission: code });
      if (!decision.allowed) throw new ForbiddenError(`Permission denied: ${code}`);
      next();
    });
  }

  function requireAnyPermission(...codes: string[]): RequestHandler {
    return asyncHandler(async (req, _res, next) => {
      const ctx = await ensureAuthContext(req);
      const roleId = ctx.membership.role_id ?? null;
      const [perms, policies] = await Promise.all([
        permsFor(req, roleId),
        policiesFor(req, ctx.organization.id, roleId),
      ]);
      const ok = codes.some((code) => decide({ ctx, permission: code }, perms, policies).allowed);
      if (!ok) throw new ForbiddenError(`Permission denied: requires one of ${codes.join(', ')}`);
      next();
    });
  }

  function requirePolicy(action: string, subject: string, loadResource?: ResourceLoader): RequestHandler {
    return asyncHandler(async (req, _res, next) => {
      const ctx = await ensureAuthContext(req);
      const resource = loadResource ? await loadResource(req, ctx) : null;
      const branchId = resource && typeof resource.branch_id === 'string' ? resource.branch_id : undefined;
      const decision = await evaluateReq(req, { action, subject, resource, branchId });
      if (!decision.allowed) {
        throw new ForbiddenError(`Not permitted: ${action} ${subject}`, decision.reason ? { error: decision.reason } : undefined);
      }
      next();
    });
  }

  async function getBranchScope(req: Request): Promise<BranchScope> {
    const ctx = await ensureAuthContext(req);
    return branchScopeFromMembership(ctx.membership);
  }

  return {
    ensureAuthContext,
    loadUserOrg,
    requirePermission,
    requireAnyPermission,
    requirePolicy,
    getBranchScope,
    can,
  };
}
