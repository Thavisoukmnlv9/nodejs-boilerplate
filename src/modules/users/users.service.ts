import type { Prisma } from '@/generated/prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '@/common/errors';
import { paginate, type Paginated } from '@/common/utils/pagination';
import { type UsersRepository, usersRepository } from '@/modules/users/users.repository';
import type { InviteUserInput, ListUsersQuery, UpdateUserInput } from '@/modules/users/users.schema';
import type { MemberView } from '@/modules/users/users.types';

type MemberWithUser = Prisma.OrganizationMemberGetPayload<{ include: { user: true } }>;

function toView(m: MemberWithUser): MemberView {
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
    branch_ids: m.branch_ids,
    default_branch_id: m.default_branch_id,
    staff_title: m.staff_title,
    staff_note: m.staff_note,
    invited_at: m.invited_at.toISOString(),
    accepted_at: m.accepted_at?.toISOString() ?? null,
  };
}

/**
 * Org-scoped member management. Every method is bound to the caller's current org
 * (from the RBAC context) — a user in org A can never read or mutate org B's members.
 */
export class UsersService {
  constructor(private readonly repo: UsersRepository = usersRepository) {}

  async list(organizationId: string, params: ListUsersQuery): Promise<Paginated<MemberView>> {
    const [items, total] = await this.repo.listMembers(organizationId, {
      limit: params.limit,
      offset: params.offset,
      q: params.q,
    });
    return paginate(items.map(toView), total, params);
  }

  async get(organizationId: string, memberId: string): Promise<MemberView> {
    const member = await this.repo.findMember(organizationId, memberId);
    if (!member) throw new NotFoundError('User not found');
    return toView(member);
  }

  async invite(organizationId: string, invitedById: string, input: InviteUserInput): Promise<MemberView> {
    const user =
      (await this.repo.findUserByEmail(input.email)) ??
      (await this.repo.createInvitedUser(input.email, input.name));

    if (await this.repo.findMembershipByUser(organizationId, user.id)) {
      throw new ConflictError('User is already a member of this organization');
    }

    const member = await this.repo.createMembership({
      organization_id: organizationId,
      user_id: user.id,
      role_id: input.role_id,
      branch_ids: input.branch_ids,
      default_branch_id: input.default_branch_id ?? null,
      staff_title: input.staff_title ?? null,
      staff_note: input.staff_note ?? null,
      invited_by_id: invitedById,
      // accepted_at stays null → a pending invite until the user accepts.
    });
    return toView(member);
  }

  async update(organizationId: string, memberId: string, input: UpdateUserInput): Promise<MemberView> {
    const existing = await this.repo.findMember(organizationId, memberId);
    if (!existing) throw new NotFoundError('User not found');

    if (input.name && existing.user_id) {
      await this.repo.updateUserName(existing.user_id, input.name);
    }

    const data: Prisma.OrganizationMemberUncheckedUpdateInput = {};
    if (input.role_id !== undefined) data.role_id = input.role_id;
    if (input.branch_ids !== undefined) data.branch_ids = input.branch_ids;
    if (input.default_branch_id !== undefined) data.default_branch_id = input.default_branch_id;
    if (input.staff_title !== undefined) data.staff_title = input.staff_title;
    if (input.staff_note !== undefined) data.staff_note = input.staff_note;

    const member = Object.keys(data).length > 0 ? await this.repo.updateMembership(memberId, data) : existing;
    return toView(member);
  }

  async remove(organizationId: string, memberId: string): Promise<void> {
    const existing = await this.repo.findMember(organizationId, memberId);
    if (!existing) throw new NotFoundError('User not found');
    if (existing.is_owner) throw new ForbiddenError('Cannot remove the organization owner');
    await this.repo.softDeleteMembership(memberId);
  }
}

export const usersService = new UsersService();
