import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/app';
import { disconnectPrisma } from '@/infra/prisma';

/**
 * Route integration test against a REAL test database. Requires:
 *   docker compose up -d postgres  &&  prisma migrate deploy  &&  prisma db seed
 * CI sets RUN_INTEGRATION=1 after provisioning services; locally it's skipped so
 * `npm test` (unit) passes without infra. Exercises auth → RBAC → users end-to-end.
 */
const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('Users API (integration)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
    expect(res.status).toBe(200);
    return res.body.access_token as string;
  }

  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('detail');
  });

  it('lists members for an owner (has platform.users.read)', async () => {
    const token = await login('owner@demo.test');
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toMatchObject({ limit: expect.any(Number), offset: expect.any(Number), total: expect.any(Number) });
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('forbids a read-only member from inviting (403, lacks platform.users.invite)', async () => {
    const token = await login('member@demo.test');
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new.hire@demo.test', role_id: 'role_cashier' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('forbidden');
  });

  it('returns /me bootstrap for the owner', async () => {
    const token = await login('owner@demo.test');
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('owner@demo.test');
    expect(res.body.permissions).toContain('platform.users.read');
    expect(res.body.entitlements.modules).toContain('pos_shop');
  });
});
