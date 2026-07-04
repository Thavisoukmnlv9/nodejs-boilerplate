import { evaluatePolicies, matchConditions } from '@/access/policy';
import { branchScopeFromMembership, resolveBranchWhere } from '@/access/branch-scope';
import type { PolicyRule, PrincipalAttrs } from '@/access/types';

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
