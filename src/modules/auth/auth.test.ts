import { AuthService } from '@/modules/auth/auth.service';
import type { AuthRepository } from '@/modules/auth/auth.repository';
import { hashPassword } from '@/common/utils/password';
import { verifyAccessToken } from '@/common/utils/token';
import { ForbiddenError, UnauthorizedError } from '@/common/errors';

// Keep the unit test hermetic — no Redis/BullMQ side effects on import.
jest.mock('@/jobs/queues/email.queue', () => ({ enqueuePasswordResetEmail: jest.fn(async () => undefined) }));

const meta = { ipAddress: '127.0.0.1', userAgent: 'jest' };

/** Minimal fake AuthRepository — only the methods `login` touches. */
function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    createSession: jest.fn(async () => ({ id: 'sess_1' })),
    bindSessionToken: jest.fn(async () => ({})),
    touchLastLogin: jest.fn(async () => ({})),
    ...overrides,
  } as unknown as AuthRepository;
}

describe('AuthService.login', () => {
  it('issues tokens for valid credentials and embeds the active org_id', async () => {
    const password_hash = await hashPassword('Password123');
    const repo = makeRepo({
      findUserByEmail: jest.fn(async () => ({
        id: 'user_1',
        password_hash,
        status: 'ACTIVE',
        organization_members: [{ organization_id: 'org_1', accepted_at: new Date() }],
      })),
    });

    const result = await new AuthService(repo).login({ email: 'owner@demo.test', password: 'Password123' }, meta);

    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBe(900);
    const decoded = verifyAccessToken(result.accessToken);
    expect(decoded.sub).toBe('user_1');
    expect(decoded.org_id).toBe('org_1');
    expect(repo.createSession).toHaveBeenCalledTimes(1);
    expect(repo.touchLastLogin).toHaveBeenCalledWith('user_1');
  });

  it('rejects an invalid password with 401', async () => {
    const password_hash = await hashPassword('Password123');
    const repo = makeRepo({
      findUserByEmail: jest.fn(async () => ({ id: 'user_1', password_hash, status: 'ACTIVE', organization_members: [] })),
    });
    await expect(new AuthService(repo).login({ email: 'x@y.z', password: 'wrongpass1' }, meta)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rejects an unknown email with 401 (same message — no enumeration)', async () => {
    const repo = makeRepo({ findUserByEmail: jest.fn(async () => null) });
    await expect(new AuthService(repo).login({ email: 'x@y.z', password: 'Password123' }, meta)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('forbids an inactive user with 403', async () => {
    const password_hash = await hashPassword('Password123');
    const repo = makeRepo({
      findUserByEmail: jest.fn(async () => ({ id: 'user_1', password_hash, status: 'INACTIVE', organization_members: [] })),
    });
    await expect(new AuthService(repo).login({ email: 'x@y.z', password: 'Password123' }, meta)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
