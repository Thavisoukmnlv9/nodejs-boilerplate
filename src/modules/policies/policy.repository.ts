import type { Prisma } from '@/generated/prisma/client';
import type { PolicyRule } from '@/access/types';
import { BaseRepository } from '@/infra/prisma';

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

  list(organizationId: string, opts: { limit: number; offset: number; subject?: string; action?: string; role_id?: string }) {
    const where: Prisma.PolicyWhereInput = {
      organization_id: organizationId,
      ...(opts.subject ? { subject: opts.subject } : {}),
      ...(opts.action ? { action: opts.action } : {}),
      ...(opts.role_id ? { role_id: opts.role_id } : {}),
    };
    return Promise.all([
      this.db.policy.findMany({ where, orderBy: [{ created_at: 'desc' }], take: opts.limit, skip: opts.offset }),
      this.db.policy.count({ where }),
    ]);
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
