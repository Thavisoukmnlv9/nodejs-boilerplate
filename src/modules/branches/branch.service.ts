import type { Branch } from '@/generated/prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '@/common/errors';
import { paginate, type Paginated } from '@/common/utils/pagination';
import { type BranchRepository, branchRepository } from '@/modules/branches/branch.repository';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from '@/modules/branches/branch.schema';
import type { BranchView } from '@/modules/branches/branch.types';

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
    });
    return paginate(items.map(toView), total, params);
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
