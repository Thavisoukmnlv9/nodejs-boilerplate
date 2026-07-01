import { BaseRepository } from '@/infra/prisma';

export class RoleRepository extends BaseRepository {
  findWithPermissions(roleId: string) {
    return this.db.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
  }

  /** Global system roles (organization_id null) + this org's custom roles. */
  listForOrg(organizationId: string, limit: number, offset: number) {
    const where = {
      ...this.notDeleted,
      OR: [{ organization_id: null }, { organization_id: organizationId }],
    };
    return Promise.all([
      this.db.role.findMany({
        where,
        orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
        include: { _count: { select: { permissions: true, members: true } } },
      }),
      this.db.role.count({ where }),
    ]);
  }
}

export const roleRepository = new RoleRepository();
