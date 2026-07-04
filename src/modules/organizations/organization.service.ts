import type { Branch, OrganizationMember } from '@/generated/prisma/client';
import { env } from '@/config/env';
import { UserStatus } from '@/config/constants';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '@/common/errors';
import { signAccessToken } from '@/common/utils/token';
import type { AuthContext } from '@/common/types/context';
import { type OrganizationRepository, organizationRepository } from '@/modules/organizations/organization.repository';
import type { CreateOrganizationInput } from '@/modules/organizations/organization.schema';

interface CreatedOrgResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    currency_code: string;
    locale: string;
    timezone: string;
  };
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

/**
 * Resolves the full request principal — the Express equivalent of the reference's
 * `get_current_user_and_org`. Enforces: user exists & ACTIVE, token carries an org,
 * membership is accepted (not a pending invite), org exists.
 */
export class OrganizationService {
  constructor(private readonly repo: OrganizationRepository = organizationRepository) {}

  async loadContext(userId: string, orgId: string | null): Promise<AuthContext> {
    const user = await this.repo.findUserWithMemberships(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Not authenticated');
    }
    if (!orgId) {
      throw new BadRequestError('No organization in token');
    }
    const membership = user.organization_members.find((m) => m.organization_id === orgId);
    if (!membership || !membership.accepted_at) {
      throw new ForbiddenError('Not a member of this organization or invite pending');
    }
    const organization = await this.repo.findById(orgId);
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }
    return { user, organization, membership };
  }

  /** Branches a member may operate: owners see all active branches; others see their assigned set. */
  async getBranchesForMember(
    membership: OrganizationMember & { branch_access?: { branch_id: string }[] },
  ): Promise<Branch[]> {
    if (!membership.organization_id) return [];
    if (membership.is_owner) return this.repo.findActiveBranches(membership.organization_id);
    const ids = (membership.branch_access ?? []).map((a) => a.branch_id);
    if (ids.length === 0) return [];
    return this.repo.findBranchesByIds(membership.organization_id, ids);
  }

  /**
   * Onboarding: create an org, make the caller Owner, and mint a fresh access token
   * carrying the new org_id so the SPA is immediately in-org (paired with the
   * repository repointing the caller's existing org-less sessions).
   */
  async createOrganization(userId: string, input: CreateOrganizationInput): Promise<CreatedOrgResponse> {
    const org = await this.repo.createOrganizationWithOwner(userId, input);
    return {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo_url: org.logo_url,
        currency_code: org.currency_code,
        locale: org.locale,
        timezone: org.timezone,
      },
      access_token: signAccessToken(userId, org.id),
      token_type: 'bearer',
      expires_in: env.accessTtlSec,
    };
  }
}

export const organizationService = new OrganizationService();
