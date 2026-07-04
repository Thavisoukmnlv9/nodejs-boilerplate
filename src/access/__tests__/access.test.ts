import { jest } from '@jest/globals';
import type { RequestHandler } from 'express';
import { evaluatePolicies, matchConditions } from '@/access/policy';
import { branchScopeFromMembership, resolveBranchWhere } from '@/access/branch-scope';
import { createAccessControl } from '@/access/create-access-control';
import type { AccessControlDeps, AuthContext, PolicyRule, PrincipalAttrs } from '@/access/types';

const principal: PrincipalAttrs = {
  userId: 'u1',
  organizationId: 'o1',
  isOwner: false,
  roleId: 'r1',
  branchIds: ['b1', 'b2'],
};

describe('policy evaluator', () => {
  it('returns null (no opinion) when nothing matches', () => {
    expect(evaluatePolicies([], 'read', 'Branch', { principal }).allowed).toBeNull();
  });

  it('an ALLOW grants', () => {
    const p: PolicyRule[] = [{ effect: 'ALLOW', action: 'read', subject: 'Branch' }];
    expect(evaluatePolicies(p, 'read', 'Branch', { principal }).allowed).toBe(true);
  });

  it('DENY wins over ALLOW (and over wildcards)', () => {
    const p: PolicyRule[] = [
      { effect: 'ALLOW', action: '*', subject: 'Branch' },
      { effect: 'DENY', action: 'delete', subject: 'Branch' },
    ];
    expect(evaluatePolicies(p, 'delete', 'Branch', { principal }).allowed).toBe(false);
  });

  it('applies attribute conditions (literal eq)', () => {
    const p: PolicyRule[] = [
      { effect: 'DENY', action: 'delete', subject: 'Branch', conditions: { 'resource.is_main': true } },
    ];
    expect(evaluatePolicies(p, 'delete', 'Branch', { principal, resource: { is_main: true } }).allowed).toBe(false);
    expect(evaluatePolicies(p, 'delete', 'Branch', { principal, resource: { is_main: false } }).allowed).toBeNull();
  });

  it('resolves { var } operands from the principal (in-operator)', () => {
    const conditions = { 'resource.branch_id': { in: { var: 'principal.branchIds' } } };
    expect(matchConditions(conditions, { principal, resource: { branch_id: 'b1' } })).toBe(true);
    expect(matchConditions(conditions, { principal, resource: { branch_id: 'bX' } })).toBe(false);
  });

  it('supports numeric operators', () => {
    expect(matchConditions({ 'resource.total': { lte: 100 } }, { principal, resource: { total: 50 } })).toBe(true);
    expect(matchConditions({ 'resource.total': { lte: 100 } }, { principal, resource: { total: 150 } })).toBe(false);
  });
});

describe('branch scope', () => {
  const owner = { is_owner: true, default_branch_id: 'b1', branch_access: [{ branch_id: 'b1' }] };
  const staff = {
    is_owner: false,
    default_branch_id: 'b1',
    branch_access: [{ branch_id: 'b1' }, { branch_id: 'b2' }],
  };

  it('owner is unscoped and may reach any branch', () => {
    const scope = branchScopeFromMembership(owner as never);
    expect(scope.allowed).toBeNull();
    expect(resolveBranchWhere('bX', scope)).toBe('bX');
    expect(resolveBranchWhere(undefined, scope)).toBeUndefined();
  });

  it('staff clamps to their assigned set', () => {
    const scope = branchScopeFromMembership(staff as never);
    expect(resolveBranchWhere(undefined, scope)).toEqual({ in: ['b1', 'b2'] });
    expect(resolveBranchWhere('b1', scope)).toBe('b1');
  });

  it('staff reaching outside scope throws (403 branch_not_permitted)', () => {
    const scope = branchScopeFromMembership(staff as never);
    expect(() => resolveBranchWhere('bX', scope)).toThrow(/not permitted/i);
  });
});

// --- decision seam: an access-control instance over mock deps ---
function makeCtx(opts: { isOwner?: boolean; roleId?: string | null; branchIds?: string[] } = {}): AuthContext {
  return {
    user: { id: 'u1' },
    organization: { id: 'o1' },
    membership: {
      is_owner: opts.isOwner ?? false,
      role_id: opts.roleId === undefined ? 'r1' : opts.roleId,
      default_branch_id: null,
      branch_access: (opts.branchIds ?? []).map((branch_id) => ({ branch_id })),
    },
  } as unknown as AuthContext;
}

function makeAC(opts: { perms?: string[]; policies?: PolicyRule[] } = {}) {
  const resolvePermissions = jest.fn(async () => opts.perms ?? []);
  const loadPolicies = jest.fn(async () => opts.policies ?? []);
  const loadContext = jest.fn(async () => makeCtx());
  const deps: AccessControlDeps = { loadContext, resolvePermissions, loadPolicies };
  return { ac: createAccessControl(deps), resolvePermissions, loadPolicies, loadContext };
}

function runGuard(handler: RequestHandler, req: unknown): Promise<{ error?: unknown }> {
  return new Promise((resolve) => {
    handler(req as never, {} as never, ((error?: unknown) => resolve({ error })) as never);
  });
}

/**
 * Full decision matrix for the `decide()` seam (exercised via the public `can()`).
 * Freezes the invariants: order is policy DENY-wins -> branch scope -> RBAC; owners
 * bypass RBAC + branch scope but NOT an explicit policy DENY.
 */
describe('decision matrix — can()', () => {
  it('RBAC: owner is allowed without holding the permission code', async () => {
    const { ac } = makeAC({ perms: [] });
    expect((await ac.can({ ctx: makeCtx({ isOwner: true }), permission: 'x' })).allowed).toBe(true);
  });

  it('RBAC: staff holding the code is allowed', async () => {
    const { ac } = makeAC({ perms: ['x'] });
    expect((await ac.can({ ctx: makeCtx(), permission: 'x' })).allowed).toBe(true);
  });

  it('RBAC: staff missing the code is denied (permission_denied)', async () => {
    const { ac } = makeAC({ perms: ['other'] });
    expect(await ac.can({ ctx: makeCtx(), permission: 'x' })).toEqual({
      allowed: false,
      reason: 'permission_denied',
    });
  });

  it('policy ALLOW grants even without an RBAC code', async () => {
    const { ac } = makeAC({ policies: [{ effect: 'ALLOW', action: 'read', subject: 'Branch' }] });
    expect((await ac.can({ ctx: makeCtx(), action: 'read', subject: 'Branch' })).allowed).toBe(true);
  });

  it('policy DENY wins over a held RBAC permission (policy_denied, evaluated first)', async () => {
    const { ac } = makeAC({
      perms: ['x'],
      policies: [{ effect: 'DENY', action: 'read', subject: 'Branch' }],
    });
    expect(
      await ac.can({ ctx: makeCtx(), permission: 'x', action: 'read', subject: 'Branch' }),
    ).toEqual({ allowed: false, reason: 'policy_denied' });
  });

  it('branch scope: staff outside their branch set is denied (branch_not_permitted)', async () => {
    const { ac } = makeAC({ perms: ['x'] });
    expect(
      await ac.can({ ctx: makeCtx({ branchIds: ['b1'] }), permission: 'x', branchId: 'bX' }),
    ).toEqual({ allowed: false, reason: 'branch_not_permitted' });
  });

  it('branch scope: owner bypasses branch scope', async () => {
    const { ac } = makeAC({ perms: [] });
    expect(
      (await ac.can({ ctx: makeCtx({ isOwner: true }), permission: 'x', branchId: 'bX' })).allowed,
    ).toBe(true);
  });

  it('branch scope: staff inside their set with the code is allowed', async () => {
    const { ac } = makeAC({ perms: ['x'] });
    expect(
      (await ac.can({ ctx: makeCtx({ branchIds: ['b1', 'b2'] }), permission: 'x', branchId: 'b2' }))
        .allowed,
    ).toBe(true);
  });

  it('ordering: a policy DENY beats an out-of-scope branch (policy_denied)', async () => {
    const { ac } = makeAC({
      perms: ['x'],
      policies: [{ effect: 'DENY', action: 'read', subject: 'Branch' }],
    });
    expect(
      await ac.can({
        ctx: makeCtx({ branchIds: ['b1'] }),
        permission: 'x',
        action: 'read',
        subject: 'Branch',
        branchId: 'bX',
      }),
    ).toEqual({ allowed: false, reason: 'policy_denied' });
  });

  it('ordering: an out-of-scope branch beats RBAC (branch_not_permitted)', async () => {
    const { ac } = makeAC({ perms: [] });
    expect(
      await ac.can({ ctx: makeCtx({ branchIds: ['b1'] }), permission: 'x', branchId: 'bX' }),
    ).toEqual({ allowed: false, reason: 'branch_not_permitted' });
  });

  it('loads perms only when a permission is requested (policies untouched)', async () => {
    const { ac, resolvePermissions, loadPolicies } = makeAC({ perms: ['x'] });
    await ac.can({ ctx: makeCtx(), permission: 'x' });
    expect(resolvePermissions).toHaveBeenCalledTimes(1);
    expect(loadPolicies).not.toHaveBeenCalled();
  });
});

/**
 * Request guards over the req-cached load path (`evaluateReq` / `requireAnyPermission`).
 * The "loads exactly once" assertion locks in the consolidated load helper — it fails if
 * the shared perms+policies load is duplicated or re-fetched per code.
 */
describe('permission guards (request path)', () => {
  const req = () => ({ auth: { userId: 'u1', orgId: 'o1' } });

  it('requirePermission allows when the code is held', async () => {
    const { ac, loadContext } = makeAC({ perms: ['x'] });
    loadContext.mockResolvedValue(makeCtx());
    expect((await runGuard(ac.requirePermission('x'), req())).error).toBeUndefined();
  });

  it('requirePermission denies with "Permission denied: <code>" when missing', async () => {
    const { ac, loadContext } = makeAC({ perms: [] });
    loadContext.mockResolvedValue(makeCtx());
    const { error } = await runGuard(ac.requirePermission('x'), req());
    expect((error as Error).message).toMatch(/Permission denied: x/);
  });

  it('requireAnyPermission allows if ANY code matches, loading perms+policies exactly once', async () => {
    const { ac, loadContext, resolvePermissions, loadPolicies } = makeAC({ perms: ['a'] });
    loadContext.mockResolvedValue(makeCtx());
    const { error } = await runGuard(ac.requireAnyPermission('x', 'y', 'a'), req());
    expect(error).toBeUndefined();
    expect(resolvePermissions).toHaveBeenCalledTimes(1);
    expect(loadPolicies).toHaveBeenCalledTimes(1);
  });

  it('requireAnyPermission denies with the "requires one of" message when none match', async () => {
    const { ac, loadContext } = makeAC({ perms: ['z'] });
    loadContext.mockResolvedValue(makeCtx());
    const { error } = await runGuard(ac.requireAnyPermission('x', 'y'), req());
    expect((error as Error).message).toMatch(/requires one of x, y/);
  });
});
