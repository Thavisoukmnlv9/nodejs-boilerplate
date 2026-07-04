import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { env } from '@/config/env';
import { API_PREFIX } from '@/config/constants';
import { logger } from '@/config/logger';
import { loginSchema, refreshSchema, registerSchema } from '@/modules/auth/auth.schema';

extendZodWithOpenApi(z);

/**
 * OpenAPI is derived from the same Zod request schemas the routes validate against
 * — one source of truth. This documents the auth surface + /me as a representative
 * sample; extend `registry.registerPath(...)` per module as you add features.
 */
function buildDocument() {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  const errorShape = z.object({ detail: z.unknown(), code: z.string() });
  const tokenPair = z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.literal('bearer'),
    expires_in: z.number(),
  });

  const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

  registry.registerPath({
    method: 'post',
    path: `${API_PREFIX}/auth/register`,
    tags: ['auth'],
    summary: 'Register a new user',
    request: { body: json(registerSchema) },
    responses: {
      201: { description: 'Created', ...json(tokenPair.extend({ user_id: z.string(), email: z.string() })) },
      409: { description: 'Email already in use', ...json(errorShape) },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${API_PREFIX}/auth/login`,
    tags: ['auth'],
    summary: 'Login with email + password',
    request: { body: json(loginSchema) },
    responses: {
      200: { description: 'Token pair (+ httpOnly refresh cookie)', ...json(tokenPair) },
      401: { description: 'Invalid credentials', ...json(errorShape) },
    },
  });

  registry.registerPath({
    method: 'post',
    path: `${API_PREFIX}/auth/refresh`,
    tags: ['auth'],
    summary: 'Exchange a refresh token (cookie or body) for a new access token',
    request: { body: json(refreshSchema) },
    responses: {
      200: {
        description: 'New access token',
        ...json(z.object({ access_token: z.string(), token_type: z.literal('bearer'), expires_in: z.number() })),
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `${API_PREFIX}/me`,
    tags: ['me'],
    summary: 'Bootstrap: current user, org, permissions, branches, entitlements',
    security: [{ bearerAuth: [] }],
    responses: { 200: { description: 'Me payload' }, 401: { description: 'Unauthenticated', ...json(errorShape) } },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: { title: env.APP_NAME, version: env.APP_VERSION, description: 'Business Sync platform-core API' },
    servers: [{ url: '/' }],
  });
}

/** Mount Swagger UI at /docs. Never crashes boot — a doc-gen error just skips docs. */
export function setupSwagger(app: Express): void {
  if (!env.ENABLE_DOCS && env.isProd) {
    logger.info('API docs disabled (set ENABLE_DOCS=true to enable)');
    return;
  }
  try {
    const document = buildDocument();
    app.get('/openapi.json', (_req, res) => res.json(document));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: `${env.APP_NAME} — API docs` }));
    logger.info('API docs mounted at /docs');
  } catch (err) {
    logger.warn({ err }, 'Failed to build OpenAPI document; /docs disabled');
  }
}
