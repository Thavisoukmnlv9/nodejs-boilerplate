import type { Prisma } from '@/generated/prisma/client';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '@/common/errors';
import { type BulkResult, runBulk } from '@/common/utils/bulk';
import { type CsvColumn, EXPORT_ROW_CAP, toCsv } from '@/common/utils/csv';
import { paginate, type Paginated } from '@/common/utils/pagination';
import { DANGER_ZONE_CODES, isKnownPermissionCode } from '@/config/permissions';
import { type RoleRepository, roleRepository } from '@/modules/roles/role.repository';
import type { BulkRolesInput, CreateRoleInput, ExportRolesQuery, ListRolesQuery, UpdateRoleInput } from '@/modules/roles/role.schema';
import type { PermissionView, RoleStats, RoleView } from '@/modules/roles/role.types';

type RoleWithPerms = Prisma.RoleGetPayload<{
  include: { permissions: { include: { permission: true } }; _count: { select: { members: true } } };
}>;

function toView(role: RoleWithPerms): RoleView {
  return {
    id: role.id,
    organization_id: role.organization_id,
    name: role.name,
    description: role.description,
    is_system: role.is_system,
    member_count: role._count?.members ?? 0,
    permission_codes: role.permissions.map((rp) => rp.permission.code),
    created_at: role.created_at.toISOString(),
  };
}

/**
 * Role/permission management. Reference contracts, nodejs discipline: every write
 * validates against the DB catalog, blocks danger-zone grants, and refuses to touch
 * system roles. Services throw AppError; the router maps them to HTTP.
 */
export class RoleService {
  constructor(private readonly repo: RoleRepository = roleRepository) {}

  /** Effective permission codes for a role — the RBAC guard's hot path. */
  async getPermissionCodes(roleId: string | null | undefined): Promise<string[]> {
    if (!roleId) return [];
    const role = await this.repo.findWithPermissions(roleId);
    if (!role) return [];
    return role.permissions.map((rp) => rp.permission?.code).filter((c): c is string => Boolean(c));
  }

  async listRoles(organizationId: string, params: ListRolesQuery): Promise<Paginated<RoleView>> {
    const [items, total] = await this.repo.listForOrg(organizationId, {
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      sort: params.sort,
      order: params.order,
    });
    return paginate(items.map(toView), total, params);
  }

  async stats(organizationId: string): Promise<RoleStats> {
    return this.repo.roleStats(organizationId);
  }

  async exportCsv(organizationId: string, params: ExportRolesQuery): Promise<string> {
    const roles = await this.repo.listForExport(organizationId, {
      q: params.q,
      sort: params.sort,
      order: params.order,
      cap: EXPORT_ROW_CAP,
    });
    const columns: CsvColumn<RoleView>[] = [
      { key: 'name', header: 'Name', value: (r) => r.name },
      { key: 'description', header: 'Description', value: (r) => r.description },
      { key: 'is_system', header: 'System', value: (r) => r.is_system },
      { key: 'member_count', header: 'Members', value: (r) => r.member_count },
      { key: 'permission_count', header: 'Permissions', value: (r) => r.permission_codes.length },
    ];
    return toCsv(roles.map(toView), columns);
  }

  /** Bulk-delete custom roles; system/global and in-use roles are skipped per-id. */
  async bulk(organizationId: string, input: BulkRolesInput): Promise<BulkResult> {
    const roles = await this.repo.findManyForOrgByIds(organizationId, input.ids);
    const byId = new Map(roles.map((r) => [r.id, r]));
    return runBulk(input.ids, async (id) => {
      const role = byId.get(id);
      if (!role) throw new NotFoundError('Role not found');
      if (role.is_system || role.organization_id === null) throw new BadRequestError('Cannot delete a system role');
      const members = role._count?.members ?? 0;
      if (members > 0) throw new ConflictError(`${members} member(s) still have this role`);
      await this.repo.delete(id);
    });
  }

  async getRole(organizationId: string, roleId: string): Promise<RoleView> {
    const role = await this.repo.findVisible(organizationId, roleId);
    if (!role) throw new NotFoundError('Role not found');
    return toView(role);
  }

  async listPermissions(): Promise<PermissionView[]> {
    const perms = await this.repo.listPermissions();
    return perms.map((p) => ({ id: p.id, code: p.code, module: p.module, description: p.description }));
  }

  /** Reject danger-zone + unknown codes; dedupe. Validated against the catalog constant. */
  private validateCodes(codes: string[]): string[] {
    const unique = [...new Set(codes)];
    const danger = unique.filter((c) => DANGER_ZONE_CODES.includes(c));
    if (danger.length) {
      throw new ValidationError('These permissions are reserved for the Owner and cannot be granted.', { codes: danger });
    }
    const unknown = unique.filter((c) => !isKnownPermissionCode(c));
    if (unknown.length) throw new ValidationError('Unknown permission codes.', { codes: unknown });
    return unique;
  }

  private async resolvePermissionIds(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const rows = await this.repo.findPermissionIdsByCodes(codes);
    return rows.map((p) => p.id);
  }

  async createRole(organizationId: string, input: CreateRoleInput): Promise<RoleView> {
    const codes = this.validateCodes(input.permission_codes);
    if (await this.repo.findByName(organizationId, input.name)) {
      throw new ConflictError('A role with that name already exists');
    }
    const permissionIds = await this.resolvePermissionIds(codes);
    const role = await this.repo.create(organizationId, {
      name: input.name,
      description: input.description ?? null,
      permissionIds,
    });
    return toView(role);
  }

  async updateRole(organizationId: string, roleId: string, input: UpdateRoleInput): Promise<RoleView> {
    const existing = await this.repo.findVisible(organizationId, roleId);
    if (!existing) throw new NotFoundError('Role not found');
    if (existing.is_system || existing.organization_id === null) {
      throw new BadRequestError('Cannot modify a system role');
    }
    if (input.name && input.name !== existing.name) {
      const clash = await this.repo.findByName(organizationId, input.name);
      if (clash && clash.id !== roleId) throw new ConflictError('A role with that name already exists');
    }
    let permissionIds: string[] | undefined;
    if (input.permission_codes) {
      permissionIds = await this.resolvePermissionIds(this.validateCodes(input.permission_codes));
    }
    const role = await this.repo.update(organizationId, roleId, {
      name: input.name,
      description: input.description,
      permissionIds,
    });
    return toView(role);
  }

  async deleteRole(organizationId: string, roleId: string): Promise<void> {
    const existing = await this.repo.findVisible(organizationId, roleId);
    if (!existing) throw new NotFoundError('Role not found');
    if (existing.is_system || existing.organization_id === null) {
      throw new BadRequestError('Cannot delete a system role');
    }
    const members = await this.repo.countMembers(organizationId, roleId);
    if (members > 0) throw new ConflictError(`${members} member(s) still have this role`);
    await this.repo.delete(roleId);
  }
}

export const roleService = new RoleService();
