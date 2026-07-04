import { organizationService } from '@/modules/organizations/organization.service';
import { roleService } from '@/modules/roles/role.service';
import { policyRepository } from '@/modules/policies/policy.repository';
import { createAccessControl } from './create-access-control';

/**
 * APP WIRING — the single file that composes the portable `src/access/` library with
 * this app's Prisma-backed data access. Everything else under `src/access/` is
 * app-agnostic; to adopt the library elsewhere, reimplement these three deps.
 */
export const accessControl = createAccessControl({
  loadContext: (userId, orgId) => organizationService.loadContext(userId, orgId),
  resolvePermissions: (roleId) => roleService.getPermissionCodes(roleId),
  loadPolicies: (organizationId, roleId) => policyRepository.loadForMember(organizationId, roleId),
});

export const {
  ensureAuthContext,
  loadUserOrg,
  requirePermission,
  requireAnyPermission,
  requirePolicy,
  getBranchScope,
  can,
} = accessControl;
