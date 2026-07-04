import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/app';

/**
 * Infra-free characterization of the HTTP error contract (`{ detail, code }`).
 *
 * These pin the body-parser + Zod + errorHandler wire shapes that the Zod 4 and
 * Express 5 migrations pass straight through. Every case fails at parsing or schema
 * validation BEFORE any repository call, so no database is needed and this runs
 * under the default `npm test` (it is intentionally NOT gated by RUN_INTEGRATION).
 * The DB-dependent cases (duplicated-param dedupe, upload 413, org onboarding) live
 * in the RUN_INTEGRATION suites.
 *
 * `/auth/reset-password` is used for the schema cases: it validates before the
 * service and carries no rate limiter, so repeated calls can't flake on a 429.
 */
describe('HTTP error contract (infra-free)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('404s an unknown route as { detail: string, code: "not_found" }', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
    expect(typeof res.body.detail).toBe('string');
  });

  it('400s a malformed JSON body as { detail: "Malformed JSON body", code: "bad_request" }', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Content-Type', 'application/json')
      .send('{ "token": '); // deliberately truncated → JSON parse failure
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('bad_request');
    expect(res.body.detail).toBe('Malformed JSON body');
  });

  it('413s an oversize body as { code: "payload_too_large" }', async () => {
    const huge = 'x'.repeat(1_100_000); // exceeds the 1mb BODY_LIMIT
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 't', new_password: huge });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('payload_too_large');
  });

  it('422s a schema-invalid body as { detail: DetailIssue[], code: "validation_error" }', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').send({}); // missing token + new_password
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('validation_error');
    // Structure is the contract; issue messages/type codes are allowed to drift across the Zod 4 upgrade.
    expect(Array.isArray(res.body.detail)).toBe(true);
    expect(res.body.detail.length).toBeGreaterThanOrEqual(1);
    const issue = res.body.detail[0];
    expect(issue.loc[0]).toBe('body');
    expect(typeof issue.msg).toBe('string');
    expect(typeof issue.type).toBe('string');
  });
});
