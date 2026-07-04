import type { Prisma } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';

type IdFilter = string | { in: string[] };

/** Branch is HARD-deleted — no `this.notDeleted` filters here. */
export class BranchRepository extends BaseRepository {
  list(
    organizationId: string,
    opts: { limit: number; offset: number; q?: string; is_active?: boolean; vertical?: string; idFilter?: IdFilter },
  ) {
    const where: Prisma.BranchWhereInput = {
      organization_id: organizationId,
      ...(opts.idFilter ? { id: opts.idFilter } : {}),
      ...(opts.is_active !== undefined ? { is_active: opts.is_active } : {}),
      ...(opts.vertical ? { vertical: opts.vertical } : {}),
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: 'insensitive' } },
              { code: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.branch.findMany({ where, orderBy: [{ is_main: 'desc' }, { name: 'asc' }], take: opts.limit, skip: opts.offset }),
      this.db.branch.count({ where }),
    ]);
  }

  findInOrg(organizationId: string, id: string) {
    return this.db.branch.findFirst({ where: { id, organization_id: organizationId } });
  }

  findByCode(organizationId: string, code: string) {
    return this.db.branch.findFirst({ where: { organization_id: organizationId, code } });
  }

  countInOrg(organizationId: string) {
    return this.db.branch.count({ where: { organization_id: organizationId } });
  }

  create(data: Prisma.BranchUncheckedCreateInput) {
    return this.db.branch.create({ data });
  }

  update(id: string, data: Prisma.BranchUncheckedUpdateInput) {
    return this.db.branch.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.db.branch.delete({ where: { id } });
  }

  /** Promote one branch to main, demoting every other in the org (atomic singleton). */
  makeMain(organizationId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { organization_id: organizationId, is_main: true, NOT: { id } },
        data: { is_main: false },
      });
      return tx.branch.update({ where: { id }, data: { is_main: true } });
    });
  }
}

export const branchRepository = new BranchRepository();
