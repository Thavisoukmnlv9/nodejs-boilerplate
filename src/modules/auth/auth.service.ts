import { Prisma } from '@/generated/prisma/client';
import { env } from '@/config/env';
import { UserStatus } from '@/config/constants';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '@/common/errors';
import { hashPassword, verifyPassword } from '@/common/utils/password';
import { sha256Hex } from '@/common/utils/hash';
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
} from '@/common/utils/token';
import { sendPasswordResetEmail } from '@/infra/email/email.service';
import { hashOpaqueToken } from '@/access/tokens';
import { type AuthRepository, authRepository } from '@/modules/auth/auth.repository';
import { usersRepository } from '@/modules/users/users.repository';
import type { IssuedTokens, RequestMeta, SessionResponse } from '@/modules/auth/auth.types';
import type {
  AcceptInviteInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@/modules/auth/auth.schema';

/**
 * Auth business logic. Refresh tokens are STATEFUL: every login/register persists a
 * Session, the refresh token carries its `session_id`, and refresh/logout/logout-all
 * validate & revoke via that row. We do NOT rotate the token STRING on refresh — the
 * SPA reuses its stored refresh token and only reads the new access token, so
 * rotation would break it (documented trade-off). We DO bind the session to a hash
 * of its refresh token (`refresh_token_hash`) and verify it on refresh, giving
 * revocation + token-binding without breaking the client.
 */
export class AuthService {
  constructor(private readonly repo: AuthRepository = authRepository) {}

  private refreshExpiry(): Date {
    return new Date(Date.now() + env.refreshTtlSec * 1000);
  }

  /** Create the Session, mint tokens bound to it, and record the token hash. */
  private async issueSession(
    userId: string,
    organizationId: string | null,
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    const session = await this.repo.createSession({
      userId,
      organizationId,
      expiresAt: this.refreshExpiry(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    const refreshToken = signRefreshToken(userId, session.id);
    await this.repo.bindSessionToken(session.id, sha256Hex(refreshToken));
    return {
      accessToken: signAccessToken(userId, organizationId),
      refreshToken,
      expiresIn: env.accessTtlSec,
    };
  }

  async register(input: RegisterInput, meta: RequestMeta): Promise<IssuedTokens & { userId: string; email: string }> {
    const passwordHash = await hashPassword(input.password);
    let user;
    try {
      user = await this.repo.createUser({
        email: input.email,
        password_hash: passwordHash,
        name: input.display_name ?? null,
        status: UserStatus.ACTIVE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Email already in use');
      }
      throw err;
    }
    // Fresh registrations have no org yet (org_id stays null until they create/join one).
    const tokens = await this.issueSession(user.id, null, meta);
    return { ...tokens, userId: user.id, email: input.email };
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<IssuedTokens> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('User is inactive');
    }
    // Active org = first accepted membership (or null → user must pick one later).
    const accepted = user.organization_members.find((m) => m.accepted_at && m.organization_id);
    const orgId = accepted?.organization_id ?? null;

    const tokens = await this.issueSession(user.id, orgId, meta);
    await this.repo.touchLastLogin(user.id);
    return tokens;
  }

  async refresh(token: string): Promise<{ accessToken: string; expiresIn: number }> {
    const payload = verifyRefreshToken(token);
    const session = await this.repo.findSessionById(payload.session_id);

    if (!session || session.revoked_at) {
      throw new UnauthorizedError('Invalid or expired session');
    }
    if (!session.expires_at || session.expires_at.getTime() < Date.now()) {
      if (!session.revoked_at) await this.repo.revokeSession(session.id);
      throw new UnauthorizedError('Invalid or expired session');
    }
    if (!session.user || session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('User is inactive');
    }
    // Token-binding: reject a token that doesn't match the one this session was
    // issued for. Skipped when the hash is null (e.g. a session created by the
    // FastAPI reference, which doesn't populate it) for shared-DB compatibility.
    if (session.refresh_token_hash && session.refresh_token_hash !== sha256Hex(token)) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    return {
      accessToken: signAccessToken(session.user.id, session.organization_id),
      expiresIn: env.accessTtlSec,
    };
  }

  /** Lenient: revokes the token's session if decodable; always succeeds. */
  async logout(token: string | null): Promise<void> {
    if (!token) return;
    try {
      const payload = verifyRefreshToken(token);
      await this.repo.revokeSession(payload.session_id);
    } catch {
      // Invalid/expired token → nothing to revoke; the cookie is cleared anyway.
    }
  }

  async logoutAll(userId: string): Promise<number> {
    const { count } = await this.repo.revokeAllForUser(userId);
    return count;
  }

  /** Never reveals whether the email exists (no account-enumeration leak). */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user?.email) return;
    const token = signResetToken(user.id);
    const resetUrl = `${env.WEB_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      // Sent inline (no queue). Swallow failures so we never leak whether the email exists.
      await sendPasswordResetEmail({ to: user.email, resetUrl, userId: user.id });
    } catch {
      // Delivery errors are logged inside the email service; nothing to surface here.
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    let userId: string;
    try {
      userId = verifyResetToken(input.token).sub;
    } catch {
      throw new BadRequestError('Invalid or expired reset token');
    }
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundError('User not found');

    await this.repo.setPassword(user.id, await hashPassword(input.new_password));
    // Force re-login everywhere after a password change.
    await this.repo.revokeAllForUser(user.id);
  }

  /**
   * Accept an org invite: validate the one-time token (hash + expiry), set the
   * user's password, mark the membership accepted, and auto-login — same response
   * shape as /auth/login, scoped to the inviting org.
   */
  async acceptInvite(input: AcceptInviteInput, meta: RequestMeta): Promise<IssuedTokens> {
    const member = await usersRepository.findByInviteTokenHash(hashOpaqueToken(input.token));
    if (!member || !member.user_id || !member.organization_id) {
      throw new BadRequestError('Invalid or already-accepted invite');
    }
    if (member.invitation_expires_at && member.invitation_expires_at.getTime() < Date.now()) {
      throw new BadRequestError('This invite has expired');
    }
    const passwordHash = await hashPassword(input.password);
    await usersRepository.acceptInvite(member.id, member.user_id, passwordHash, input.name);
    const tokens = await this.issueSession(member.user_id, member.organization_id, meta);
    await this.repo.touchLastLogin(member.user_id);
    return tokens;
  }

  async listSessions(userId: string): Promise<SessionResponse[]> {
    const sessions = await this.repo.listActiveSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      organization_id: s.organization_id,
      device_info: s.device_info,
      created_at: s.created_at.toISOString(),
      expires_at: s.expires_at?.toISOString() ?? null,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.repo.findOwnedSession(sessionId, userId);
    if (!session) throw new NotFoundError('Session not found');
    await this.repo.revokeSession(sessionId);
  }
}

export const authService = new AuthService();
