import type { Prisma } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';
import { buildOrderBy, type SortOrder } from '@/common/utils/sortableQuery';

/** Member count is always scoped to the current org + excludes soft-deleted members. */
function memberCount(organizationId: string) {
  return { select: { members: { where: { organization_id: organizationId, deleted_at: null } } } } satisfies Prisma.RoleCountOutputTypeDefaultArgs;
}

const withPermissions = { permissions: { include: { permission: true } } } satisfies Prisma.RoleInclude;

/** Public sort column → Prisma orderBy for the roles list. */
const ROLE_ORDER_BY: Record<string, (dir: SortOrder) => Prisma.RoleOrderByWithRelationInput> = {
  name: (dir) => ({ name: dir }),
  created_at: (dir) => ({ created_at: dir }),
  is_system: (dir) => ({ is_system: dir }),
};

// Default: system roles first, then alphabetical.
const ROLE_DEFAULT_ORDER: Prisma.RoleOrderByWithRelationInput[] = [{ is_system: 'desc' }, { name: 'asc' }];

/** Visible roles for an org (its own custom roles + global system roles), with optional search. */
function buildRoleListWhere(organizationId: string, q?: string): Prisma.RoleWhereInput {
  return {
    OR: [{ organization_id: null }, { organization_id: organizationId }],
    ...(q
      ? {
          AND: [
            {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
          ],
        }
      : {}),
  };
}

/** Role is HARD-deleted — no `this.notDeleted` filters here. */
export class RoleRepository extends BaseRepository {
  /** Hot path behind the RBAC guard: resolve a role's permission codes. */
  findWithPermissions(roleId: string) {
    return this.db.role.findUnique({ where: { id: roleId }, include: withPermissions });
  }

  /** A role visible to the org: its own custom role, or a global system role. */
  findVisible(organizationId: string, roleId: string) {
    return this.db.role.findFirst({
      where: { id: roleId, OR: [{ organization_id: organizationId }, { organization_id: null, is_system: true }] },
      include: { ...withPermissions, _count: memberCount(organizationId) },
    });
  }

  listForOrg(organizationId: string, opts: { limit: number; offset: number; q?: string; sort?: string; order?: SortOrder }) {
    const where = buildRoleListWhere(organizationId, opts.q);
    const orderBy = buildOrderBy(opts.sort, opts.order ?? 'desc', ROLE_ORDER_BY, ROLE_DEFAULT_ORDER);
    return Promise.all([
      this.db.role.findMany({
        where,
        orderBy,
        take: opts.limit,
        skip: opts.offset,
        include: { ...withPermissions, _count: memberCount(organizationId) },
      }),
      this.db.role.count({ where }),
    ]);
  }

  /** All visible roles matching the search (no pagination) — export path, hard-capped. */
  listForExport(organizationId: string, opts: { q?: string; sort?: string; order?: SortOrder; cap: number }) {
    const where = buildRoleListWhere(organizationId, opts.q);
    const orderBy = buildOrderBy(opts.sort, opts.order ?? 'desc', ROLE_ORDER_BY, ROLE_DEFAULT_ORDER);
    return this.db.role.findMany({
      where,
      orderBy,
      take: opts.cap,
      include: { ...withPermissions, _count: memberCount(organizationId) },
    });
  }

  /** Load visible roles by id (with org-scoped member counts) for bulk-delete guards. */
  findManyForOrgByIds(organizationId: string, ids: string[]) {
    return this.db.role.findMany({
      where: { id: { in: ids }, OR: [{ organization_id: organizationId }, { organization_id: null, is_system: true }] },
      include: { _count: memberCount(organizationId) },
    });
  }

  /** Aggregate counts for the stat cards. */
  async roleStats(organizationId: string) {
    const [total, system, custom, unused] = await Promise.all([
      this.db.role.count({ where: { OR: [{ organization_id: null }, { organization_id: organizationId }] } }),
      this.db.role.count({ where: { organization_id: null } }),
      this.db.role.count({ where: { organization_id: organizationId } }),
      this.db.role.count({
        where: { organization_id: organizationId, members: { none: { organization_id: organizationId, deleted_at: null } } },
      }),
    ]);
    return { total, system, custom, unused };
  }

  findByName(organizationId: string, name: string) {
    return this.db.role.findFirst({ where: { organization_id: organizationId, name } });
  }

  countMembers(organizationId: string, roleId: string) {
    return this.db.organizationMember.count({
      where: { organization_id: organizationId, role_id: roleId, deleted_at: null },
    });
  }

  listPermissions() {
    return this.db.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  findPermissionIdsByCodes(codes: string[]) {
    return this.db.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
  }

  create(organizationId: string, data: { name: string; description: string | null; permissionIds: string[] }) {
    return this.db.role.create({
      data: {
        organization_id: organizationId,
        name: data.name,
        description: data.description,
        is_system: false,
        permissions: { create: data.permissionIds.map((permission_id) => ({ permission_id })) },
      },
      include: { ...withPermissions, _count: memberCount(organizationId) },
    });
  }

  /** Update scalars and (optionally) replace the whole permission set atomically. */
  update(
    organizationId: string,
    roleId: string,
    data: { name?: string; description?: string | null; permissionIds?: string[] },
  ) {
    return this.db.$transaction(async (tx) => {
      if (data.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { role_id: roleId } });
        if (data.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: data.permissionIds.map((permission_id) => ({ role_id: roleId, permission_id })),
          });
        }
      }
      return tx.role.update({
        where: { id: roleId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
        include: { ...withPermissions, _count: memberCount(organizationId) },
      });
    });
  }

  delete(roleId: string) {
    return this.db.role.delete({ where: { id: roleId } });
  }
}

export const roleRepository = new RoleRepository();
