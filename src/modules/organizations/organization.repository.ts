import type { Branch, Organization } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';

interface CreateOrgInput {
  name: string;
  slug?: string;
  currency_code?: string;
  locale?: string;
  timezone?: string;
  first_branch_name?: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'org'
  );
}

/** Data access for identity/tenancy resolution. Owns no HTTP concerns. */
export class OrganizationRepository extends BaseRepository {
  findUserWithMemberships(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      include: {
        // branch_access powers the access library's branch-scope resolution.
        organization_members: {
          include: { branch_access: { select: { branch_id: true } } },
        },
      },
    });
  }

  findById(organizationId: string) {
    return this.db.organization.findUnique({ where: { id: organizationId } });
  }

  // Branch is hard-deleted (no deleted_at) — do NOT spread this.notDeleted here.
  findActiveBranches(organizationId: string): Promise<Branch[]> {
    return this.db.branch.findMany({
      where: { organization_id: organizationId, is_active: true },
      orderBy: [{ is_main: 'desc' }, { name: 'asc' }],
    });
  }

  findBranchesByIds(organizationId: string, ids: string[]): Promise<Branch[]> {
    return this.db.branch.findMany({
      where: { organization_id: organizationId, id: { in: ids }, is_active: true },
      orderBy: [{ is_main: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Onboarding: atomically create an Organization, make the caller its Owner, seed an
   * optional first (main) branch, and repoint the caller's org-less sessions at the new
   * org so a token refresh keeps the org (the P0 "onboarding org-drop" fix).
   */
  createOrganizationWithOwner(userId: string, input: CreateOrgInput): Promise<Organization> {
    return this.db.$transaction(async (tx) => {
      const base = slugify(input.slug ?? input.name);
      let slug = base;
      for (let n = 2; await tx.organization.findUnique({ where: { slug } }); n += 1) slug = `${base}-${n}`;

      const org = await tx.organization.create({
        data: {
          name: input.name,
          slug,
          currency_code: input.currency_code ?? 'USD',
          locale: input.locale ?? 'en-US',
          timezone: input.timezone ?? 'UTC',
        },
      });

      let branchId: string | null = null;
      if (input.first_branch_name) {
        const branch = await tx.branch.create({
          data: {
            organization_id: org.id,
            name: input.first_branch_name,
            code: 'MAIN',
            is_main: true,
            currency_code: org.currency_code,
            locale: org.locale,
            timezone: org.timezone,
          },
        });
        branchId = branch.id;
      }

      const member = await tx.organizationMember.create({
        data: {
          organization_id: org.id,
          user_id: userId,
          role_id: 'role_owner', // seeded global system role
          is_owner: true,
          accepted_at: new Date(),
          default_branch_id: branchId,
        },
      });
      if (branchId) await tx.memberBranchAccess.create({ data: { member_id: member.id, branch_id: branchId } });

      await tx.session.updateMany({
        where: { user_id: userId, organization_id: null, revoked_at: null },
        data: { organization_id: org.id },
      });

      return org;
    });
  }
}

export const organizationRepository = new OrganizationRepository();
