import type { Branch, OrganizationMember } from '@/generated/prisma/client';
import { UserStatus } from '@/config/constants';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '@/common/errors';
import type { AuthContext } from '@/common/types/context';
import { type OrganizationRepository, organizationRepository } from '@/modules/organizations/organization.repository';

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
  async getBranchesForMember(membership: OrganizationMember): Promise<Branch[]> {
    if (!membership.organization_id) return [];
    if (membership.is_owner) return this.repo.findActiveBranches(membership.organization_id);
    if (!membership.branch_ids?.length) return [];
    return this.repo.findBranchesByIds(membership.organization_id, membership.branch_ids);
  }
}

export const organizationService = new OrganizationService();
