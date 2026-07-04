import type { Prisma } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';

/** Member count is always scoped to the current org + excludes soft-deleted members. */
function memberCount(organizationId: string) {
  return { select: { members: { where: { organization_id: organizationId, deleted_at: null } } } } satisfies Prisma.RoleCountOutputTypeDefaultArgs;
}

const withPermissions = { permissions: { include: { permission: true } } } satisfies Prisma.RoleInclude;

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

  listForOrg(organizationId: string, limit: number, offset: number) {
    const where: Prisma.RoleWhereInput = { OR: [{ organization_id: null }, { organization_id: organizationId }] };
    return Promise.all([
      this.db.role.findMany({
        where,
        orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
        include: { ...withPermissions, _count: memberCount(organizationId) },
      }),
      this.db.role.count({ where }),
    ]);
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
