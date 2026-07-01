import compression from 'compression';
import helmet from 'helmet';
import hpp from 'hpp';
import type { RequestHandler } from 'express';

/**
 * Security & hygiene middleware, applied globally in app.ts.
 * - helmet: secure headers (CSP is intentionally not forced here since this is a
 *   JSON API behind a same-origin SPA; enable/customize per deployment).
 * - hpp: collapse duplicated query params (`?a=1&a=2`) to prevent parameter
 *   pollution. (This is why we target Express 4 — Express 5 makes req.query
 *   read-only, which hpp cannot rewrite.)
 * - compression: gzip responses.
 */
export const helmetMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

export const hppMiddleware: RequestHandler = hpp();

export const compressionMiddleware: RequestHandler = compression();

/** Max JSON/urlencoded body size accepted by the body parsers. */
export const BODY_LIMIT = '1mb';
