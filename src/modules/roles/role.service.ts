import { paginate, type PaginationParams } from '@/common/utils/pagination';
import { type RoleRepository, roleRepository } from '@/modules/roles/role.repository';

/**
 * Role/permission read logic. `getPermissionCodes` is the hot path behind every
 * `requirePermission` guard: it resolves the effective permission codes granted by
 * a role. (A per-request WeakMap in the guard memoizes this so composed guards on
 * one route hit the DB once.)
 */
export class RoleService {
  constructor(private readonly repo: RoleRepository = roleRepository) {}

  async getPermissionCodes(roleId: string | null | undefined): Promise<string[]> {
    if (!roleId) return [];
    const role = await this.repo.findWithPermissions(roleId);
    if (!role) return [];
    return role.permissions
      .map((rp) => rp.permission?.code)
      .filter((code): code is string => Boolean(code));
  }

  async listRoles(organizationId: string, params: PaginationParams) {
    const [items, total] = await this.repo.listForOrg(organizationId, params.limit, params.offset);
    return paginate(items, total, params);
  }
}

export const roleService = new RoleService();
