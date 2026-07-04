import type { Prisma, UserStatus } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';

const withDetails = {
  user: true,
  branch_access: { select: { branch_id: true } },
} satisfies Prisma.OrganizationMemberInclude;

/**
 * Build the Prisma `where` for a member listing from the optional filters. Pure and
 * exported so the filter matrix (q / status / role_id, incl. the PENDING vs accepted
 * special-case) can be unit-tested without a database.
 */
export function buildMemberListWhere(
  organizationId: string,
  opts: { q?: string; status?: string; role_id?: string },
  notDeleted: { deleted_at: null },
): Prisma.OrganizationMemberWhereInput {
  const userWhere: Prisma.UserWhereInput = {};
  if (opts.status && opts.status !== 'PENDING') userWhere.status = opts.status as UserStatus;
  if (opts.q) {
    userWhere.OR = [
      { name: { contains: opts.q, mode: 'insensitive' } },
      { email: { contains: opts.q, mode: 'insensitive' } },
    ];
  }
  return {
    organization_id: organizationId,
    ...notDeleted,
    ...(opts.role_id ? { role_id: opts.role_id } : {}),
    ...(opts.status === 'PENDING' ? { accepted_at: null } : {}),
    ...(opts.status && opts.status !== 'PENDING' ? { accepted_at: { not: null } } : {}),
    ...(Object.keys(userWhere).length ? { user: userWhere } : {}),
  };
}

/** Add branch-access rows for a member (no-op for an empty list). */
async function createBranchAccess(tx: Prisma.TransactionClient, memberId: string, branchIds: string[]): Promise<void> {
  if (!branchIds.length) return;
  await tx.memberBranchAccess.createMany({
    data: branchIds.map((branch_id) => ({ member_id: memberId, branch_id })),
    skipDuplicates: true,
  });
}

/** Replace a member's branch access: clear existing rows, then re-create from the list. */
async function replaceBranchAccess(tx: Prisma.TransactionClient, memberId: string, branchIds: string[]): Promise<void> {
  await tx.memberBranchAccess.deleteMany({ where: { member_id: memberId } });
  await createBranchAccess(tx, memberId, branchIds);
}

export class UsersRepository extends BaseRepository {
  listMembers(
    organizationId: string,
    opts: { limit: number; offset: number; q?: string; status?: string; role_id?: string },
  ) {
    const where = buildMemberListWhere(organizationId, opts, this.notDeleted);
    return Promise.all([
      this.db.organizationMember.findMany({
        where,
        include: withDetails,
        orderBy: [{ is_owner: 'desc' }, { invited_at: 'desc' }],
        take: opts.limit,
        skip: opts.offset,
      }),
      this.db.organizationMember.count({ where }),
    ]);
  }

  findMember(organizationId: string, memberId: string) {
    return this.db.organizationMember.findFirst({
      where: { id: memberId, organization_id: organizationId, ...this.notDeleted },
      include: withDetails,
    });
  }

  findMembershipByUser(organizationId: string, userId: string) {
    return this.db.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId, ...this.notDeleted },
    });
  }

  findByInviteTokenHash(hash: string) {
    return this.db.organizationMember.findFirst({
      where: { invitation_token_hash: hash, accepted_at: null, ...this.notDeleted },
      include: { user: true },
    });
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  createInvitedUser(email: string, name?: string) {
    return this.db.user.create({ data: { email, name: name ?? null, status: 'ACTIVE' } });
  }

  // Tenant-isolation checks — a member's role/branches must belong to the caller's org.
  findRoleForOrg(organizationId: string, roleId: string) {
    return this.db.role.findFirst({
      where: { id: roleId, OR: [{ organization_id: organizationId }, { organization_id: null, is_system: true }] },
    });
  }

  findOrgBranchIds(organizationId: string, ids: string[]) {
    return this.db.branch.findMany({ where: { organization_id: organizationId, id: { in: ids } }, select: { id: true } });
  }

  createMembership(data: {
    organization_id: string;
    user_id: string;
    role_id: string;
    branch_ids: string[];
    default_branch_id: string | null;
    staff_title: string | null;
    staff_note: string | null;
    invited_by_id: string;
    invitation_token_hash: string;
    invitation_expires_at: Date;
  }) {
    return this.db.$transaction(async (tx) => {
      const member = await tx.organizationMember.create({
        data: {
          organization_id: data.organization_id,
          user_id: data.user_id,
          role_id: data.role_id,
          default_branch_id: data.default_branch_id,
          staff_title: data.staff_title,
          staff_note: data.staff_note,
          invited_by_id: data.invited_by_id,
          invitation_token_hash: data.invitation_token_hash,
          invitation_expires_at: data.invitation_expires_at,
        },
      });
      await createBranchAccess(tx, member.id, data.branch_ids);
      return tx.organizationMember.findUniqueOrThrow({ where: { id: member.id }, include: withDetails });
    });
  }

  updateMembership(
    memberId: string,
    data: { scalars: Prisma.OrganizationMemberUncheckedUpdateInput; branch_ids?: string[] },
  ) {
    return this.db.$transaction(async (tx) => {
      if (Object.keys(data.scalars).length) {
        await tx.organizationMember.update({ where: { id: memberId }, data: data.scalars });
      }
      if (data.branch_ids) {
        await replaceBranchAccess(tx, memberId, data.branch_ids);
      }
      return tx.organizationMember.findUniqueOrThrow({ where: { id: memberId }, include: withDetails });
    });
  }

  regenerateInvite(memberId: string, hash: string, expiresAt: Date) {
    return this.db.organizationMember.update({
      where: { id: memberId },
      data: { invitation_token_hash: hash, invitation_expires_at: expiresAt },
      include: withDetails,
    });
  }

  /** Accept an invite: set the user's password + mark the membership accepted (atomic). */
  acceptInvite(memberId: string, userId: string, passwordHash: string, name?: string) {
    return this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password_hash: passwordHash, email_verified_at: new Date(), status: 'ACTIVE', ...(name ? { name } : {}) },
      });
      return tx.organizationMember.update({
        where: { id: memberId },
        data: { accepted_at: new Date(), invitation_token_hash: null, invitation_expires_at: null },
      });
    });
  }

  updateUserName(userId: string, name: string) {
    return this.db.user.update({ where: { id: userId }, data: { name } });
  }

  softDeleteMembership(id: string) {
    return this.db.organizationMember.update({ where: { id }, data: this.softDeletePatch() });
  }
}

export const usersRepository = new UsersRepository();
