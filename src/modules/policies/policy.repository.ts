import { Prisma } from '@/generated/prisma/client';
import type { PolicyRule } from '@/access/types';
import { BaseRepository } from '@/infra/prisma';
import { buildOrderBy, type SortOrder } from '@/common/utils/sortableQuery';

type PolicyListFilters = { subject?: string; action?: string; role_id?: string };

/** Public sort column → Prisma orderBy for the policies list. */
const POLICY_ORDER_BY: Record<string, (dir: SortOrder) => Prisma.PolicyOrderByWithRelationInput> = {
  effect: (dir) => ({ effect: dir }),
  action: (dir) => ({ action: dir }),
  subject: (dir) => ({ subject: dir }),
  created_at: (dir) => ({ created_at: dir }),
  updated_at: (dir) => ({ updated_at: dir }),
};

const POLICY_DEFAULT_ORDER: Prisma.PolicyOrderByWithRelationInput[] = [{ created_at: 'desc' }];

function buildPolicyListWhere(organizationId: string, opts: PolicyListFilters): Prisma.PolicyWhereInput {
  return {
    organization_id: organizationId,
    ...(opts.subject ? { subject: opts.subject } : {}),
    ...(opts.action ? { action: opts.action } : {}),
    ...(opts.role_id ? { role_id: opts.role_id } : {}),
  };
}

/** Policy is HARD-deleted. */
export class PolicyRepository extends BaseRepository {
  /** Policies applicable to a member: org-wide (role_id null) + the member's own role. */
  async loadForMember(organizationId: string, roleId: string | null): Promise<PolicyRule[]> {
    const rows = await this.db.policy.findMany({
      where: {
        organization_id: organizationId,
        OR: roleId ? [{ role_id: null }, { role_id: roleId }] : [{ role_id: null }],
      },
    });
    return rows.map((p) => ({
      effect: p.effect,
      action: p.action,
      subject: p.subject,
      conditions: p.conditions,
      role_id: p.role_id,
    }));
  }

  list(organizationId: string, opts: PolicyListFilters & { limit: number; offset: number; sort?: string; order?: SortOrder }) {
    const where = buildPolicyListWhere(organizationId, opts);
    const orderBy = buildOrderBy(opts.sort, opts.order ?? 'desc', POLICY_ORDER_BY, POLICY_DEFAULT_ORDER);
    return Promise.all([
      this.db.policy.findMany({ where, orderBy, take: opts.limit, skip: opts.offset }),
      this.db.policy.count({ where }),
    ]);
  }

  /** All policies matching the filters (no pagination) — export path, hard-capped. */
  listForExport(organizationId: string, opts: PolicyListFilters & { sort?: string; order?: SortOrder; cap: number }) {
    const where = buildPolicyListWhere(organizationId, opts);
    const orderBy = buildOrderBy(opts.sort, opts.order ?? 'desc', POLICY_ORDER_BY, POLICY_DEFAULT_ORDER);
    return this.db.policy.findMany({ where, orderBy, take: opts.cap });
  }

  findManyInOrgByIds(organizationId: string, ids: string[]) {
    return this.db.policy.findMany({ where: { id: { in: ids }, organization_id: organizationId } });
  }

  /** Aggregate counts for the stat cards. `conditions` non-null = conditional. */
  async policyStats(organizationId: string) {
    const base: Prisma.PolicyWhereInput = { organization_id: organizationId };
    const [total, allow, deny, unconditional] = await Promise.all([
      this.db.policy.count({ where: base }),
      this.db.policy.count({ where: { ...base, effect: 'ALLOW' } }),
      this.db.policy.count({ where: { ...base, effect: 'DENY' } }),
      this.db.policy.count({ where: { ...base, conditions: { equals: Prisma.DbNull } } }),
    ]);
    return { total, allow, deny, conditional: total - unconditional };
  }

  findInOrg(organizationId: string, id: string) {
    return this.db.policy.findFirst({ where: { id, organization_id: organizationId } });
  }

  /** A role a policy may attach to: this org's custom role or a global system role. */
  findRoleInOrg(organizationId: string, roleId: string) {
    return this.db.role.findFirst({
      where: { id: roleId, OR: [{ organization_id: organizationId }, { organization_id: null, is_system: true }] },
    });
  }

  create(data: Prisma.PolicyUncheckedCreateInput) {
    return this.db.policy.create({ data });
  }

  update(id: string, data: Prisma.PolicyUncheckedUpdateInput) {
    return this.db.policy.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.db.policy.delete({ where: { id } });
  }
}

export const policyRepository = new PolicyRepository();
