import type { Prisma } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';

export interface CreateSessionInput {
  userId: string;
  organizationId: string | null;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuthRepository extends BaseRepository {
  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email }, include: { organization_members: true } });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  createUser(data: Prisma.UserCreateInput) {
    return this.db.user.create({ data });
  }

  touchLastLogin(id: string) {
    return this.db.user.update({ where: { id }, data: { last_login_at: new Date() } });
  }

  setPassword(id: string, passwordHash: string) {
    return this.db.user.update({ where: { id }, data: { password_hash: passwordHash } });
  }

  createSession(input: CreateSessionInput) {
    return this.db.session.create({
      data: {
        user_id: input.userId,
        organization_id: input.organizationId,
        expires_at: input.expiresAt,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    });
  }

  bindSessionToken(id: string, refreshTokenHash: string) {
    return this.db.session.update({
      where: { id },
      data: { refresh_token_hash: refreshTokenHash, last_active_at: new Date() },
    });
  }

  findSessionById(id: string) {
    return this.db.session.findUnique({ where: { id }, include: { user: true } });
  }

  revokeSession(id: string) {
    return this.db.session.update({ where: { id }, data: { revoked_at: new Date() } });
  }

  revokeAllForUser(userId: string) {
    return this.db.session.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  listActiveSessions(userId: string) {
    return this.db.session.findMany({
      where: { user_id: userId, revoked_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
  }

  findOwnedSession(id: string, userId: string) {
    return this.db.session.findFirst({ where: { id, user_id: userId } });
  }
}

export const authRepository = new AuthRepository();
