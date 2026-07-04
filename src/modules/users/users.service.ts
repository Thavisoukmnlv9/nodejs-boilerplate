import type { Prisma } from '@/generated/prisma/client';
import { generateOpaqueToken } from '@/access/tokens';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/common/errors';
import { paginate, type Paginated } from '@/common/utils/pagination';
import { type UsersRepository, usersRepository } from '@/modules/users/users.repository';
import type { InviteUserInput, ListUsersQuery, UpdateUserInput } from '@/modules/users/users.schema';
import type { InviteIssued, MemberView } from '@/modules/users/users.types';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type MemberWithDetails = Prisma.OrganizationMemberGetPayload<{
  include: { user: true; branch_access: { select: { branch_id: true } } };
}>;

function toView(m: MemberWithDetails): MemberView {
  const status = m.accepted_at ? (m.user?.status ?? 'ACTIVE') : 'PENDING';
  return {
    id: m.id,
    user: {
      id: m.user?.id ?? '',
      email: m.user?.email ?? null,
      name: m.user?.name ?? null,
      avatar_url: m.user?.avatar_url ?? null,
      status: m.user?.status ?? 'ACTIVE',
    },
    role_id: m.role_id,
    is_owner: m.is_owner,
    status,
    branch_ids: m.branch_access.map((a) => a.branch_id),
    default_branch_id: m.default_branch_id,
    staff_title: m.staff_title,
    staff_note: m.staff_note,
    invited_at: m.invited_at.toISOString(),
    invitation_expires_at: m.invitation_expires_at?.toISOString() ?? null,
    accepted_at: m.accepted_at?.toISOString() ?? null,
  };
}

/**
 * Org-scoped member management. Every method is bound to the caller's current org.
 * Role + branch assignments are validated to belong to that org (tenant isolation),
 * and a member cannot change/remove their own or the owner's role.
 */
export class UsersService {
  constructor(private readonly repo: UsersRepository = usersRepository) {}

  async list(organizationId: string, params: ListUsersQuery): Promise<Paginated<MemberView>> {
    const [items, total] = await this.repo.listMembers(organizationId, {
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      status: params.status,
      role_id: params.role_id,
    });
    return paginate(items.map(toView), total, params);
  }

  async get(organizationId: string, memberId: string): Promise<MemberView> {
    const member = await this.repo.findMember(organizationId, memberId);
    if (!member) throw new NotFoundError('User not found');
    return toView(member);
  }

  /** Role + branch_ids must belong to the caller's org. */
  private async validateAssignment(organizationId: string, roleId: string | undefined, branchIds: string[] | undefined): Promise<void> {
    if (roleId) {
      const role = await this.repo.findRoleForOrg(organizationId, roleId);
      if (!role) throw new ValidationError('role_id does not belong to this organization', { role_id: roleId });
    }
    if (branchIds && branchIds.length) {
      const found = await this.repo.findOrgBranchIds(organizationId, branchIds);
      const foundSet = new Set(found.map((b) => b.id));
      const missing = branchIds.filter((id) => !foundSet.has(id));
      if (missing.length) throw new ValidationError('branch_ids include branches outside this organization', { branch_ids: missing });
    }
  }

  /** An owner's role is immutable, and a member cannot change their own role. */
  private assertRoleChangeAllowed(existing: MemberWithDetails, actingUserId: string): void {
    if (existing.is_owner) throw new ForbiddenError("Cannot change the owner's role");
    if (existing.user_id === actingUserId) throw new ForbiddenError('You cannot change your own role');
  }

  /** Collect only the explicitly-provided scalar fields into a Prisma update patch. */
  private buildScalarPatch(input: UpdateUserInput): Prisma.OrganizationMemberUncheckedUpdateInput {
    const scalars: Prisma.OrganizationMemberUncheckedUpdateInput = {};
    if (input.role_id !== undefined) scalars.role_id = input.role_id;
    if (input.default_branch_id !== undefined) scalars.default_branch_id = input.default_branch_id;
    if (input.staff_title !== undefined) scalars.staff_title = input.staff_title;
    if (input.staff_note !== undefined) scalars.staff_note = input.staff_note;
    return scalars;
  }

  async invite(organizationId: string, invitedById: string, input: InviteUserInput): Promise<InviteIssued> {
    await this.validateAssignment(organizationId, input.role_id, input.branch_ids);
    if (input.default_branch_id && !input.branch_ids.includes(input.default_branch_id)) {
      throw new ValidationError('default_branch_id must be one of branch_ids', { default_branch_id: input.default_branch_id });
    }

    const email = input.email.toLowerCase();
    const user = (await this.repo.findUserByEmail(email)) ?? (await this.repo.createInvitedUser(email, input.name));
    if (await this.repo.findMembershipByUser(organizationId, user.id)) {
      throw new ConflictError('User is already a member of this organization');
    }

    const { token, hash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const member = await this.repo.createMembership({
      organization_id: organizationId,
      user_id: user.id,
      role_id: input.role_id,
      branch_ids: input.branch_ids,
      default_branch_id: input.default_branch_id ?? null,
      staff_title: input.staff_title ?? null,
      staff_note: input.staff_note ?? null,
      invited_by_id: invitedById,
      invitation_token_hash: hash,
      invitation_expires_at: expiresAt,
    });
    return { member: toView(member), invite_token: token, invitation_expires_at: expiresAt.toISOString() };
  }

  async update(organizationId: string, memberId: string, actingUserId: string, input: UpdateUserInput): Promise<MemberView> {
    const existing = await this.repo.findMember(organizationId, memberId);
    if (!existing) throw new NotFoundError('User not found');

    if (input.role_id !== undefined) this.assertRoleChangeAllowed(existing, actingUserId);
    await this.validateAssignment(organizationId, input.role_id, input.branch_ids);

    const effectiveBranchIds = input.branch_ids ?? existing.branch_access.map((a) => a.branch_id);
    if (input.default_branch_id && !effectiveBranchIds.includes(input.default_branch_id)) {
      throw new ValidationError('default_branch_id must be one of the assigned branches', { default_branch_id: input.default_branch_id });
    }

    if (input.name && existing.user_id) await this.repo.updateUserName(existing.user_id, input.name);

    const scalars = this.buildScalarPatch(input);
    const member = await this.repo.updateMembership(memberId, { scalars, branch_ids: input.branch_ids });
    return toView(member);
  }

  async remove(organizationId: string, memberId: string, actingUserId: string): Promise<void> {
    const existing = await this.repo.findMember(organizationId, memberId);
    if (!existing) throw new NotFoundError('User not found');
    if (existing.is_owner) throw new ForbiddenError('Cannot remove the organization owner');
    if (existing.user_id === actingUserId) throw new ForbiddenError('You cannot remove yourself');
    await this.repo.softDeleteMembership(memberId);
  }

  async resendInvite(organizationId: string, memberId: string): Promise<InviteIssued> {
    const existing = await this.repo.findMember(organizationId, memberId);
    if (!existing) throw new NotFoundError('User not found');
    if (existing.accepted_at) throw new ConflictError('This member has already accepted their invite');
    const { token, hash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const member = await this.repo.regenerateInvite(memberId, hash, expiresAt);
    return { member: toView(member), invite_token: token, invitation_expires_at: expiresAt.toISOString() };
  }
}

export const usersService = new UsersService();
