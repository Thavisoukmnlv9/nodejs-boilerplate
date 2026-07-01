import type { Organization, User } from '@prisma/client';
import { UserStatus } from '@/config/constants';
import { BadRequestError, UnauthorizedError } from '@/common/errors';
import { organizationRepository } from '@/modules/organizations/organization.repository';
import { organizationService } from '@/modules/organizations/organization.service';
import { roleService } from '@/modules/roles/role.service';
import { entitlementService } from '@/modules/entitlements/entitlement.service';
import { EMPTY_ENTITLEMENTS } from '@/modules/entitlements/entitlement.types';
import type { MeOrganization, MeResponse, MeUser } from '@/modules/me/me.types';

function toMeUser(user: User): MeUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name,
    phone: user.phone,
    avatar_url: user.avatar_url,
    status: user.status,
    email_verified_at: user.email_verified_at?.toISOString() ?? null,
    last_login_at: user.last_login_at?.toISOString() ?? null,
    mfa_enabled: user.mfa_enabled,
    is_platform_staff: user.is_platform_staff,
    platform_staff_role: user.platform_staff_role,
  };
}

function toMeOrg(org: Organization): MeOrganization {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo_url: org.logo_url,
    currency: org.currency_code,
    locale: org.locale,
  };
}

/**
 * Assembles the bootstrap payload. Two shapes: a tenant user (org + permissions +
 * branches + entitlements) and a platform-staff user with no active org (org null,
 * empty permissions/entitlements) — matching the reference `/me`.
 */
export class MeService {
  async getMe(userId: string, orgId: string | null): Promise<MeResponse> {
    const user = await organizationRepository.findUserWithMemberships(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Not authenticated');
    }

    const meUser = toMeUser(user);

    if (!orgId) {
      if (user.is_platform_staff) {
        return {
          user: meUser,
          organization: null,
          permissions: [],
          branches: [],
          default_branch_id: null,
          entitlements: EMPTY_ENTITLEMENTS,
        };
      }
      throw new BadRequestError('No organization in token');
    }

    const ctx = await organizationService.loadContext(userId, orgId);
    const [permissions, branches, entitlements] = await Promise.all([
      roleService.getPermissionCodes(ctx.membership.role_id),
      organizationService.getBranchesForMember(ctx.membership),
      entitlementService.getEntitlements(ctx.organization.id),
    ]);

    return {
      user: meUser,
      organization: toMeOrg(ctx.organization),
      permissions,
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name ?? '',
        is_default: b.id === ctx.membership.default_branch_id,
      })),
      default_branch_id: ctx.membership.default_branch_id ?? null,
      entitlements,
    };
  }
}

export const meService = new MeService();
