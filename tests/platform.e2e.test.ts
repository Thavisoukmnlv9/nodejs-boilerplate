import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/app';
import { disconnectPrisma } from '@/infra/prisma';
import { verifyAccessToken } from '@/common/utils/token';

/**
 * Route integration tests for the access-control platform (roles, branches, the ABAC
 * policy layer, invite→accept, and register→onboarding). Real test DB — gated by
 * RUN_INTEGRATION (set after `prisma migrate deploy && prisma db seed`).
 */
const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;
const RUN = String(Date.now()).slice(-7);

describeIntegration('Access-control platform (integration)', () => {
  let app: Express;
  // Memoize tokens per email — repeated logins would trip the login rate-limiter.
  const tokenCache = new Map<string, string>();
  const login = async (email: string): Promise<string> => {
    const cached = tokenCache.get(email);
    if (cached) return cached;
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
    expect(res.status).toBe(200);
    const token = res.body.access_token as string;
    tokenCache.set(email, token);
    return token;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(() => {
    app = createApp();
  });
  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('Roles', () => {
    it('lists system roles and the permission catalog', async () => {
      const t = await login('owner@demo.test');
      const roles = await request(app).get('/api/v1/roles').set(auth(t));
      expect(roles.status).toBe(200);
      expect(roles.body.items.some((r: { name: string }) => r.name === 'Owner')).toBe(true);

      const perms = await request(app).get('/api/v1/roles/permissions').set(auth(t));
      expect(perms.status).toBe(200);
      expect(perms.body.length).toBeGreaterThanOrEqual(80);
      // Registered before /:id — must NOT be treated as a role lookup.
      expect(perms.body.some((p: { code: string }) => p.code === 'platform.roles.manage')).toBe(true);
    });

    it('creates a custom role and rejects danger-zone / unknown codes', async () => {
      const t = await login('owner@demo.test');
      const ok = await request(app)
        .post('/api/v1/roles')
        .set(auth(t))
        .send({ name: `QA Role ${RUN}`, permission_codes: ['platform.branches.read'] });
      expect(ok.status).toBe(201);
      expect(ok.body.permission_codes).toContain('platform.branches.read');
      expect(ok.body.is_system).toBe(false);

      const danger = await request(app)
        .post('/api/v1/roles')
        .set(auth(t))
        .send({ name: `QA Danger ${RUN}`, permission_codes: ['platform.organization.delete'] });
      expect(danger.status).toBe(422);

      const unknown = await request(app)
        .post('/api/v1/roles')
        .set(auth(t))
        .send({ name: `QA Unknown ${RUN}`, permission_codes: ['bogus.code'] });
      expect(unknown.status).toBe(422);

      // cleanup
      await request(app).delete(`/api/v1/roles/${ok.body.id}`).set(auth(t)).expect(204);
    });

    it('refuses to modify or delete a system role', async () => {
      const t = await login('owner@demo.test');
      expect((await request(app).patch('/api/v1/roles/role_owner').set(auth(t)).send({ name: 'X' })).status).toBe(400);
      expect((await request(app).delete('/api/v1/roles/role_owner').set(auth(t))).status).toBe(400);
    });

    it('forbids a read-only member from creating roles', async () => {
      const t = await login('member@demo.test');
      const res = await request(app).post('/api/v1/roles').set(auth(t)).send({ name: `Nope ${RUN}` });
      expect(res.status).toBe(403);
    });
  });

  describe('Branches + ABAC policy', () => {
    it('creates a non-main branch, enforces unique code, and blocks is_main:false', async () => {
      const t = await login('owner@demo.test');
      const created = await request(app)
        .post('/api/v1/branches')
        .set(auth(t))
        .send({ name: `QA Branch ${RUN}`, code: `QA${RUN.slice(-4)}` });
      expect(created.status).toBe(201);
      expect(created.body.is_main).toBe(false);

      const dup = await request(app)
        .post('/api/v1/branches')
        .set(auth(t))
        .send({ name: `QA Dup ${RUN}`, code: `QA${RUN.slice(-4)}` });
      expect(dup.status).toBe(409);

      const demote = await request(app).patch(`/api/v1/branches/${created.body.id}`).set(auth(t)).send({ is_main: false });
      expect(demote.status).toBe(400);

      // non-main delete is allowed (policy only protects the main branch)
      expect((await request(app).delete(`/api/v1/branches/${created.body.id}`).set(auth(t))).status).toBe(204);
    });

    it('DENIES deleting the main branch via the seeded ABAC policy (DENY-wins)', async () => {
      const t = await login('owner@demo.test');
      const res = await request(app).delete('/api/v1/branches/branch_demo_main').set(auth(t));
      expect(res.status).toBe(403);
      // The stored policy fired (not the service-level 400).
      expect(res.body).toHaveProperty('code', 'forbidden');
    });
  });

  describe('Policies', () => {
    it('lists the seeded policy, validates role_id ownership, and round-trips CRUD', async () => {
      const t = await login('owner@demo.test');
      const list = await request(app).get('/api/v1/policies').set(auth(t));
      expect(list.status).toBe(200);
      expect(list.body.total).toBeGreaterThanOrEqual(1);

      const created = await request(app)
        .post('/api/v1/policies')
        .set(auth(t))
        .send({ effect: 'DENY', action: 'delete', subject: 'Role', description: `QA ${RUN}` });
      expect(created.status).toBe(201);

      const badRole = await request(app)
        .post('/api/v1/policies')
        .set(auth(t))
        .send({ effect: 'ALLOW', action: 'read', subject: 'User', role_id: 'role_does_not_exist' });
      expect(badRole.status).toBe(422);

      expect((await request(app).delete(`/api/v1/policies/${created.body.id}`).set(auth(t))).status).toBe(204);
    });
  });

  describe('Invite → accept', () => {
    it('issues an invite, the invitee sets a password and can log in', async () => {
      const t = await login('owner@demo.test');
      const email = `hire.${RUN}@demo.test`;
      const invite = await request(app)
        .post('/api/v1/users')
        .set(auth(t))
        .send({ email, role_id: 'role_cashier', name: 'QA Hire' });
      expect(invite.status).toBe(201);
      expect(invite.body.member.status).toBe('PENDING');
      expect(invite.body.invite_token).toBeTruthy();

      const accept = await request(app)
        .post('/api/v1/auth/accept-invite')
        .send({ token: invite.body.invite_token, password: 'NewPass123' });
      expect(accept.status).toBe(201);
      expect(accept.body.access_token).toBeTruthy();

      const relog = await request(app).post('/api/v1/auth/login').send({ email, password: 'NewPass123' });
      expect(relog.status).toBe(200);
    });

    it('rejects cross-tenant role_id and branch_ids (tenant isolation)', async () => {
      const t = await login('owner@demo.test');
      const badRole = await request(app)
        .post('/api/v1/users')
        .set(auth(t))
        .send({ email: `x.${RUN}@demo.test`, role_id: 'role_missing' });
      expect(badRole.status).toBe(422);

      const badBranch = await request(app)
        .post('/api/v1/users')
        .set(auth(t))
        .send({ email: `y.${RUN}@demo.test`, role_id: 'role_cashier', branch_ids: ['branch_acme-foods_main'] });
      expect(badBranch.status).toBe(422);
    });
  });

  describe('Register → onboarding (P0 fixes)', () => {
    it('registers org-less, creates an org, and keeps the org across a token refresh', async () => {
      const email = `founder.${RUN}@demo.test`;
      const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Password123', display_name: 'Founder' });
      expect(reg.status).toBe(201);
      const regAccess = reg.body.access_token as string;
      const regRefresh = reg.body.refresh_token as string;
      expect(verifyAccessToken(regAccess).org_id ?? null).toBeNull();

      // /me for an org-less user → organization null (P0-2), not a 400.
      const meBefore = await request(app).get('/api/v1/me').set(auth(regAccess));
      expect(meBefore.status).toBe(200);
      expect(meBefore.body.organization).toBeNull();
      expect(meBefore.body.policies).toEqual([]);

      // Create the org (authGuard only — no org yet).
      const created = await request(app)
        .post('/api/v1/organizations')
        .set(auth(regAccess))
        .send({ name: `Founder Co ${RUN}`, first_branch_name: 'HQ' });
      expect(created.status).toBe(201);
      const orgId = created.body.organization.id as string;
      const orgToken = created.body.access_token as string;
      expect(verifyAccessToken(orgToken).org_id).toBe(orgId);

      // Now /me is in-org with Owner permissions.
      const meAfter = await request(app).get('/api/v1/me').set(auth(orgToken));
      expect(meAfter.body.organization.id).toBe(orgId);
      expect(meAfter.body.permissions).toContain('platform.roles.manage');

      // P0-1: refreshing the ORIGINAL register session now yields an org-scoped token.
      const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: regRefresh });
      expect(refreshed.status).toBe(200);
      expect(verifyAccessToken(refreshed.body.access_token).org_id).toBe(orgId);
    });
  });
});
