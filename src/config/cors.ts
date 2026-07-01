import type { CorsOptions } from 'cors';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

/**
 * Env-driven allowlist. `credentials: true` (the SPA sends the httpOnly refresh
 * cookie + Bearer header), so we must echo a concrete origin — NEVER `*`. Requests
 * with no Origin header (curl, server-to-server, same-origin) are allowed through.
 */
const allowlist = new Set(env.ALLOWED_ORIGINS);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowlist.has(origin)) {
      callback(null, true);
      return;
    }
    logger.warn({ origin }, 'CORS: blocked origin');
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Manager-Authorization'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
};
