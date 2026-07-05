import type { Branch } from '@/generated/prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '@/common/errors';
import { type BulkResult, runBulk } from '@/common/utils/bulk';
import { type CsvColumn, EXPORT_ROW_CAP, toCsv } from '@/common/utils/csv';
import { paginate, type Paginated } from '@/common/utils/pagination';
import { type BranchRepository, branchRepository } from '@/modules/branches/branch.repository';
import type { BulkBranchesInput, CreateBranchInput, ExportBranchesQuery, ListBranchesQuery, UpdateBranchInput } from '@/modules/branches/branch.schema';
import type { BranchStats, BranchView } from '@/modules/branches/branch.types';

type IdFilter = string | { in: string[] };

function toView(b: Branch): BranchView {
  return {
    id: b.id,
    organization_id: b.organization_id,
    name: b.name,
    code: b.code,
    address: b.address,
    type: b.type,
    vertical: b.vertical,
    is_active: b.is_active,
    is_main: b.is_main,
    phone: b.phone,
    email: b.email,
    timezone: b.timezone,
    currency_code: b.currency_code,
    locale: b.locale,
    tax_rate_bps: b.tax_rate_bps,
    service_fee_bps: b.service_fee_bps,
    prices_include_tax: b.prices_include_tax,
    created_at: b.created_at.toISOString(),
    updated_at: b.updated_at.toISOString(),
  };
}

/**
 * Org-scoped branch management. The branch-scope clamp (which branches a caller may
 * see) is resolved at the controller and passed in as `idFilter`; this service owns
 * the business invariants: unique code, exactly one main branch, no deleting main.
 */
export class BranchService {
  constructor(private readonly repo: BranchRepository = branchRepository) {}

  async list(organizationId: string, params: ListBranchesQuery, idFilter: IdFilter | undefined): Promise<Paginated<BranchView>> {
    const [items, total] = await this.repo.list(organizationId, {
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      is_active: params.is_active,
      vertical: params.vertical,
      idFilter,
      sort: params.sort,
      order: params.order,
    });
    return paginate(items.map(toView), total, params);
  }

  async stats(organizationId: string, idFilter: IdFilter | undefined): Promise<BranchStats> {
    return this.repo.branchStats(organizationId, idFilter);
  }

  async exportCsv(organizationId: string, params: ExportBranchesQuery, idFilter: IdFilter | undefined): Promise<string> {
    const branches = await this.repo.listForExport(organizationId, {
      q: params.q,
      is_active: params.is_active,
      vertical: params.vertical,
      idFilter,
      sort: params.sort,
      order: params.order,
      cap: EXPORT_ROW_CAP,
    });
    const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;
    const columns: CsvColumn<BranchView>[] = [
      { key: 'name', header: 'Name', value: (b) => b.name },
      { key: 'code', header: 'Code', value: (b) => b.code },
      { key: 'vertical', header: 'Vertical', value: (b) => b.vertical },
      { key: 'is_main', header: 'Main', value: (b) => b.is_main },
      { key: 'is_active', header: 'Active', value: (b) => b.is_active },
      { key: 'currency_code', header: 'Currency', value: (b) => b.currency_code },
      { key: 'tax_rate', header: 'Tax rate', value: (b) => pct(b.tax_rate_bps) },
      { key: 'service_fee', header: 'Service fee', value: (b) => pct(b.service_fee_bps) },
      { key: 'email', header: 'Email', value: (b) => b.email },
      { key: 'phone', header: 'Phone', value: (b) => b.phone },
    ];
    return toCsv(branches.map(toView), columns);
  }

  /**
   * Apply a bulk action to a set of branches, reporting per-id outcomes. `delete`
   * enforces the same "cannot delete the main branch" invariant as the single path;
   * `archive`/`activate` toggle `is_active`. Out-of-scope ids simply aren't found.
   */
  async bulk(organizationId: string, input: BulkBranchesInput, idFilter: IdFilter | undefined): Promise<BulkResult> {
    const branches = await this.repo.findByIds(organizationId, input.ids, idFilter);
    const byId = new Map(branches.map((b) => [b.id, b]));

    return runBulk(input.ids, async (id) => {
      const branch = byId.get(id);
      if (!branch) throw new NotFoundError('Branch not found');
      switch (input.action) {
        case 'delete': {
          if (branch.is_main) throw new BadRequestError('Cannot delete the main branch');
          await this.repo.delete(id);
          return;
        }
        case 'archive': {
          await this.repo.update(id, { is_active: false });
          return;
        }
        case 'activate': {
          await this.repo.update(id, { is_active: true });
          return;
        }
      }
    });
  }

  async get(organizationId: string, branchId: string): Promise<BranchView> {
    const branch = await this.repo.findInOrg(organizationId, branchId);
    if (!branch) throw new NotFoundError('Branch not found');
    return toView(branch);
  }

  async create(organizationId: string, input: CreateBranchInput): Promise<BranchView> {
    if (input.code && (await this.repo.findByCode(organizationId, input.code))) {
      throw new ConflictError('A branch with that code already exists');
    }
    const count = await this.repo.countInOrg(organizationId);
    const branch = await this.repo.create({
      organization_id: organizationId,
      ...input,
      is_main: count === 0, // first branch of the org is main
    });
    return toView(branch);
  }

  async update(organizationId: string, branchId: string, input: UpdateBranchInput): Promise<BranchView> {
    const existing = await this.repo.findInOrg(organizationId, branchId);
    if (!existing) throw new NotFoundError('Branch not found');

    if (input.is_main === false) {
      throw new BadRequestError('An organization must always have a main branch — promote another instead');
    }
    if (input.code && input.code !== existing.code) {
      const clash = await this.repo.findByCode(organizationId, input.code);
      if (clash && clash.id !== branchId) throw new ConflictError('A branch with that code already exists');
    }

    // Promote to main (atomic swap) when requested and not already main.
    if (input.is_main === true && !existing.is_main) {
      await this.repo.makeMain(organizationId, branchId);
    }

    const { is_main: _ignored, ...rest } = input; // is_main handled above, never written directly
    const updated = Object.keys(rest).length > 0 ? await this.repo.update(branchId, rest) : await this.repo.findInOrg(organizationId, branchId);
    return toView(updated!);
  }

  async remove(organizationId: string, branchId: string): Promise<void> {
    const existing = await this.repo.findInOrg(organizationId, branchId);
    if (!existing) throw new NotFoundError('Branch not found');
    if (existing.is_main) {
      throw new BadRequestError('Cannot delete the main branch — make another branch main first');
    }
    await this.repo.delete(branchId);
  }
}

export const branchService = new BranchService();
