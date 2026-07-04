import type { Organization, User } from '@/generated/prisma/client';
import { UserStatus } from '@/config/constants';
import { UnauthorizedError } from '@/common/errors';
import { organizationRepository } from '@/modules/organizations/organization.repository';
import { organizationService } from '@/modules/organizations/organization.service';
import { roleService } from '@/modules/roles/role.service';
import { policyRepository } from '@/modules/policies/policy.repository';
import type { MeEntitlements, MeOrganization, MeResponse, MeUser } from '@/modules/me/me.types';

/** Subscription models were removed → entitlements are always empty (kept for SPA compat). */
const EMPTY_ENTITLEMENTS: MeEntitlements = { modules: [], limits: {} };

function toMeUser(user: User): MeUser {
  return {
    id: user.id,
    email: user.email,
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
 * Assembles the SPA bootstrap payload. Two shapes: an in-org user (org + permissions +
 * branches + policies) and an org-less user (freshly registered OR platform staff) with
 * org null and empty lists — the SPA routes an org-less user to onboarding.
 */
export class MeService {
  async getMe(userId: string, orgId: string | null): Promise<MeResponse> {
    const user = await organizationRepository.findUserWithMemberships(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Not authenticated');
    }

    const meUser = toMeUser(user);

    if (!orgId) {
      return {
        user: meUser,
        organization: null,
        permissions: [],
        branches: [],
        default_branch_id: null,
        policies: [],
        entitlements: EMPTY_ENTITLEMENTS,
      };
    }

    const ctx = await organizationService.loadContext(userId, orgId);
    const [permissions, branches, policies] = await Promise.all([
      roleService.getPermissionCodes(ctx.membership.role_id),
      organizationService.getBranchesForMember(ctx.membership),
      policyRepository.loadForMember(ctx.organization.id, ctx.membership.role_id ?? null),
    ]);

    return {
      user: meUser,
      organization: toMeOrg(ctx.organization),
      permissions,
      branches: branches.map((b) => ({ id: b.id, name: b.name ?? '', is_default: b.id === ctx.membership.default_branch_id })),
      default_branch_id: ctx.membership.default_branch_id ?? null,
      policies: policies.map((p) => ({
        effect: p.effect,
        action: p.action,
        subject: p.subject,
        conditions: p.conditions ?? null,
        role_id: p.role_id ?? null,
      })),
      entitlements: EMPTY_ENTITLEMENTS,
    };
  }
}

export const meService = new MeService();
