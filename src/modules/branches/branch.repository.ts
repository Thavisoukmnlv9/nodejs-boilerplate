import type { Prisma } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';
import { buildOrderBy, type SortOrder } from '@/common/utils/sortableQuery';

type IdFilter = string | { in: string[] };

type BranchListFilters = { q?: string; is_active?: boolean; vertical?: string; idFilter?: IdFilter };

/** Public sort column → Prisma orderBy for the branches list. */
const BRANCH_ORDER_BY: Record<string, (dir: SortOrder) => Prisma.BranchOrderByWithRelationInput> = {
  name: (dir) => ({ name: dir }),
  code: (dir) => ({ code: dir }),
  vertical: (dir) => ({ vertical: dir }),
  is_active: (dir) => ({ is_active: dir }),
  created_at: (dir) => ({ created_at: dir }),
  updated_at: (dir) => ({ updated_at: dir }),
};

// Default ordering: main branch pinned first, then alphabetical.
const BRANCH_DEFAULT_ORDER: Prisma.BranchOrderByWithRelationInput[] = [{ is_main: 'desc' }, { name: 'asc' }];

function buildBranchListWhere(organizationId: string, opts: BranchListFilters): Prisma.BranchWhereInput {
  return {
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
}

/** Branch is HARD-deleted — no `this.notDeleted` filters here. */
export class BranchRepository extends BaseRepository {
  list(
    organizationId: string,
    opts: BranchListFilters & { limit: number; offset: number; sort?: string; order?: SortOrder },
  ) {
    const where = buildBranchListWhere(organizationId, opts);
    const orderBy = buildOrderBy(opts.sort, opts.order ?? 'desc', BRANCH_ORDER_BY, BRANCH_DEFAULT_ORDER);
    return Promise.all([
      this.db.branch.findMany({ where, orderBy, take: opts.limit, skip: opts.offset }),
      this.db.branch.count({ where }),
    ]);
  }

  /** All branches matching the filters (no pagination) — export path, hard-capped. */
  listForExport(organizationId: string, opts: BranchListFilters & { sort?: string; order?: SortOrder; cap: number }) {
    const where = buildBranchListWhere(organizationId, opts);
    const orderBy = buildOrderBy(opts.sort, opts.order ?? 'desc', BRANCH_ORDER_BY, BRANCH_DEFAULT_ORDER);
    return this.db.branch.findMany({ where, orderBy, take: opts.cap });
  }

  /** Load a set of branches for bulk-action checks, clamped to the caller's scope. */
  findByIds(organizationId: string, ids: string[], idFilter?: IdFilter) {
    return this.db.branch.findMany({
      where: { organization_id: organizationId, id: { in: ids }, ...(idFilter ? { AND: [{ id: idFilter }] } : {}) },
    });
  }

  /** Aggregate counts for the stat cards, clamped to the caller's branch scope. */
  async branchStats(organizationId: string, idFilter?: IdFilter) {
    const where = buildBranchListWhere(organizationId, { idFilter });
    const [total, active, byVertical] = await Promise.all([
      this.db.branch.count({ where }),
      this.db.branch.count({ where: { ...where, is_active: true } }),
      this.db.branch.groupBy({ by: ['vertical'], where, _count: { _all: true } }),
    ]);
    const by_vertical: Record<string, number> = {};
    for (const row of byVertical) by_vertical[row.vertical ?? 'UNSET'] = row._count._all;
    return { total, active, archived: total - active, by_vertical };
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
