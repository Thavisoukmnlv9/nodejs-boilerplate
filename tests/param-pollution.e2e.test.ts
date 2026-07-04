import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/app';
import { disconnectPrisma } from '@/infra/prisma';

/**
 * Characterizes the HTTP-parameter-pollution guard (security.ts): a duplicated query
 * param must collapse to its LAST value, so a scalar-expecting schema never receives
 * an array. This pins the behavior across the `hpp` → in-repo-middleware replacement
 * required by Express 5 (whose `req.query` is getter-only). RUN_INTEGRATION only
 * (needs a real login + DB).
 */
const describeIntegration = process.env.RUN_INTEGRATION ? describe : describe.skip;

describeIntegration('Parameter-pollution guard (integration)', () => {
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

  it('collapses a duplicated query param to its last value (no array → no 422)', async () => {
    const token = await login('owner@demo.test');
    // Without collapse, `status` arrives as ['ACTIVE','PENDING'] and the enum schema 422s.
    // With the guard it becomes the scalar 'PENDING' → the list endpoint returns 200.
    const res = await request(app)
      .get('/api/v1/users?status=ACTIVE&status=PENDING')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
