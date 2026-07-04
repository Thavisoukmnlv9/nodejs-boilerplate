import { buildMemberListWhere } from '@/modules/users/users.repository';

/**
 * Unit coverage for the extracted, pure member-list `where` builder. No database:
 * it just asserts the Prisma filter object produced for each filter combination,
 * pinning the PENDING-vs-accepted special case that is easy to regress.
 */
const notDeleted = { deleted_at: null } as const;
const ORG = 'org_1';

describe('buildMemberListWhere', () => {
  it('scopes to the org and excludes soft-deleted rows by default', () => {
    expect(buildMemberListWhere(ORG, {}, notDeleted)).toEqual({ organization_id: ORG, deleted_at: null });
  });

  it('PENDING filters to not-yet-accepted members and adds no user filter', () => {
    const where = buildMemberListWhere(ORG, { status: 'PENDING' }, notDeleted);
    expect(where.accepted_at).toBeNull();
    expect(where.user).toBeUndefined();
  });

  it('a non-PENDING status filters accepted members and the user status', () => {
    const where = buildMemberListWhere(ORG, { status: 'ACTIVE' }, notDeleted);
    expect(where.accepted_at).toEqual({ not: null });
    expect(where.user).toEqual({ status: 'ACTIVE' });
  });

  it('role_id adds a role filter', () => {
    expect(buildMemberListWhere(ORG, { role_id: 'role_x' }, notDeleted).role_id).toBe('role_x');
  });

  it('q searches name OR email (case-insensitive) via a nested user where', () => {
    const where = buildMemberListWhere(ORG, { q: 'ann' }, notDeleted);
    expect(where.user).toEqual({
      OR: [
        { name: { contains: 'ann', mode: 'insensitive' } },
        { email: { contains: 'ann', mode: 'insensitive' } },
      ],
    });
  });

  it('combines q + status + role_id', () => {
    const where = buildMemberListWhere(ORG, { q: 'bob', status: 'ACTIVE', role_id: 'r1' }, notDeleted);
    expect(where.role_id).toBe('r1');
    expect(where.accepted_at).toEqual({ not: null });
    expect(where.user).toMatchObject({ status: 'ACTIVE', OR: expect.any(Array) });
  });
});
