import type { Branch } from '@prisma/client';
import { BaseRepository } from '@/infra/prisma';

/** Data access for identity/tenancy resolution. Owns no HTTP concerns. */
export class OrganizationRepository extends BaseRepository {
  findUserWithMemberships(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      include: { organization_members: true },
    });
  }

  findById(organizationId: string) {
    return this.db.organization.findUnique({ where: { id: organizationId } });
  }

  findActiveBranches(organizationId: string): Promise<Branch[]> {
    return this.db.branch.findMany({
      where: { organization_id: organizationId, is_active: true, ...this.notDeleted },
      orderBy: [{ is_main: 'desc' }, { name: 'asc' }],
    });
  }

  findBranchesByIds(organizationId: string, ids: string[]): Promise<Branch[]> {
    return this.db.branch.findMany({
      where: { organization_id: organizationId, id: { in: ids }, is_active: true, ...this.notDeleted },
      orderBy: [{ is_main: 'desc' }, { name: 'asc' }],
    });
  }
}

export const organizationRepository = new OrganizationRepository();
