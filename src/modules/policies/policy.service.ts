import { Prisma, type Policy } from '@/generated/prisma/client';
import { NotFoundError, ValidationError } from '@/common/errors';
import { type BulkResult, runBulk } from '@/common/utils/bulk';
import { type CsvColumn, EXPORT_ROW_CAP, toCsv } from '@/common/utils/csv';
import { paginate, type Paginated } from '@/common/utils/pagination';
import { type PolicyRepository, policyRepository } from '@/modules/policies/policy.repository';
import type { BulkPoliciesInput, CreatePolicyInput, ExportPoliciesQuery, ListPoliciesQuery, UpdatePolicyInput } from '@/modules/policies/policy.schema';
import type { PolicyStats, PolicyView } from '@/modules/policies/policy.types';

function toView(p: Policy): PolicyView {
  return {
    id: p.id,
    organization_id: p.organization_id,
    role_id: p.role_id,
    effect: p.effect,
    action: p.action,
    subject: p.subject,
    conditions: p.conditions ?? null,
    description: p.description,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  };
}

/** null/undefined → SQL NULL (unconditional); an object → stored JSON. */
function jsonInput(v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

/** Org-scoped ABAC policy management. Policies refine RBAC; they never bypass it. */
export class PolicyService {
  constructor(private readonly repo: PolicyRepository = policyRepository) {}

  async list(organizationId: string, params: ListPoliciesQuery): Promise<Paginated<PolicyView>> {
    const [items, total] = await this.repo.list(organizationId, {
      limit: params.limit,
      offset: params.offset,
      subject: params.subject,
      action: params.action,
      role_id: params.role_id,
      sort: params.sort,
      order: params.order,
    });
    return paginate(items.map(toView), total, params);
  }

  async stats(organizationId: string): Promise<PolicyStats> {
    return this.repo.policyStats(organizationId);
  }

  async exportCsv(organizationId: string, params: ExportPoliciesQuery): Promise<string> {
    const policies = await this.repo.listForExport(organizationId, {
      subject: params.subject,
      action: params.action,
      role_id: params.role_id,
      sort: params.sort,
      order: params.order,
      cap: EXPORT_ROW_CAP,
    });
    const columns: CsvColumn<PolicyView>[] = [
      { key: 'effect', header: 'Effect', value: (p) => p.effect },
      { key: 'action', header: 'Action', value: (p) => p.action },
      { key: 'subject', header: 'Subject', value: (p) => p.subject },
      { key: 'applies_to', header: 'Applies to', value: (p) => (p.role_id ? p.role_id : 'Everyone') },
      { key: 'conditional', header: 'Conditional', value: (p) => (p.conditions ? 'yes' : 'no') },
      { key: 'conditions', header: 'Conditions', value: (p) => (p.conditions ? JSON.stringify(p.conditions) : '') },
      { key: 'description', header: 'Description', value: (p) => p.description },
    ];
    return toCsv(policies.map(toView), columns);
  }

  /** Bulk-delete policies; missing ids are reported as failures per-id. */
  async bulk(organizationId: string, input: BulkPoliciesInput): Promise<BulkResult> {
    const policies = await this.repo.findManyInOrgByIds(organizationId, input.ids);
    const found = new Set(policies.map((p) => p.id));
    return runBulk(input.ids, async (id) => {
      if (!found.has(id)) throw new NotFoundError('Policy not found');
      await this.repo.delete(id);
    });
  }

  async get(organizationId: string, id: string): Promise<PolicyView> {
    const policy = await this.repo.findInOrg(organizationId, id);
    if (!policy) throw new NotFoundError('Policy not found');
    return toView(policy);
  }

  private async assertRoleBelongs(organizationId: string, roleId: string | null | undefined): Promise<void> {
    if (!roleId) return;
    const role = await this.repo.findRoleInOrg(organizationId, roleId);
    if (!role) throw new ValidationError('role_id does not belong to this organization', { role_id: roleId });
  }

  async create(organizationId: string, input: CreatePolicyInput): Promise<PolicyView> {
    await this.assertRoleBelongs(organizationId, input.role_id ?? null);
    const policy = await this.repo.create({
      organization_id: organizationId,
      role_id: input.role_id ?? null,
      effect: input.effect,
      action: input.action,
      subject: input.subject,
      conditions: jsonInput(input.conditions),
      description: input.description ?? null,
    });
    return toView(policy);
  }

  async update(organizationId: string, id: string, input: UpdatePolicyInput): Promise<PolicyView> {
    const existing = await this.repo.findInOrg(organizationId, id);
    if (!existing) throw new NotFoundError('Policy not found');
    if (input.role_id !== undefined) await this.assertRoleBelongs(organizationId, input.role_id);
    const policy = await this.repo.update(id, {
      ...(input.effect !== undefined ? { effect: input.effect } : {}),
      ...(input.action !== undefined ? { action: input.action } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.role_id !== undefined ? { role_id: input.role_id } : {}),
      ...(input.conditions !== undefined ? { conditions: jsonInput(input.conditions) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    return toView(policy);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const existing = await this.repo.findInOrg(organizationId, id);
    if (!existing) throw new NotFoundError('Policy not found');
    await this.repo.delete(id);
  }
}

export const policyService = new PolicyService();
