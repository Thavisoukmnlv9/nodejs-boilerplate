import type { Prisma } from '@prisma/client';
import { BaseRepository } from '@/infra/prisma';

const withUser = { user: true } satisfies Prisma.OrganizationMemberInclude;

export class UsersRepository extends BaseRepository {
  listMembers(organizationId: string, opts: { limit: number; offset: number; q?: string }) {
    const where: Prisma.OrganizationMemberWhereInput = {
      organization_id: organizationId,
      ...this.notDeleted,
      ...(opts.q
        ? {
            user: {
              OR: [
                { name: { contains: opts.q, mode: 'insensitive' } },
                { email: { contains: opts.q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    return Promise.all([
      this.db.organizationMember.findMany({
        where,
        include: withUser,
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
      include: withUser,
    });
  }

  findMembershipByUser(organizationId: string, userId: string) {
    return this.db.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId, ...this.notDeleted },
    });
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  createInvitedUser(email: string, name?: string) {
    return this.db.user.create({ data: { email, name: name ?? null, status: 'ACTIVE' } });
  }

  createMembership(data: Prisma.OrganizationMemberUncheckedCreateInput) {
    return this.db.organizationMember.create({ data, include: withUser });
  }

  updateMembership(id: string, data: Prisma.OrganizationMemberUncheckedUpdateInput) {
    return this.db.organizationMember.update({ where: { id }, data, include: withUser });
  }

  updateUserName(userId: string, name: string) {
    return this.db.user.update({ where: { id: userId }, data: { name } });
  }

  softDeleteMembership(id: string) {
    return this.db.organizationMember.update({ where: { id }, data: this.softDeletePatch() });
  }
}

export const usersRepository = new UsersRepository();
