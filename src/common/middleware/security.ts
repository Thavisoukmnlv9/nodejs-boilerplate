import compression from 'compression';
import helmet from 'helmet';
import type { RequestHandler } from 'express';

/**
 * Security & hygiene middleware, applied globally in app.ts.
 * - helmet: secure headers (CSP is intentionally not forced here since this is a
 *   JSON API behind a same-origin SPA; enable/customize per deployment).
 * - hppMiddleware: collapse duplicated params (`?a=1&a=2`) to their LAST value so a
 *   handler never receives an array where it expects a scalar. Replaces the `hpp`
 *   package, which can't rewrite Express 5's getter-only `req.query`.
 * - compression: gzip responses.
 */
export const helmetMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/** Reduce any array-valued own keys of a plain object to their last element (last-wins). */
function collapseArrays(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) obj[key] = value[value.length - 1];
  }
}

/**
 * HTTP Parameter Pollution guard. Mirrors `hpp`'s defaults: de-pollute the query
 * string always, and the body only for urlencoded forms (JSON array fields are
 * legitimate data). `req.query` is a getter in Express 5, so the cleaned object is
 * reassigned as an own data property.
 */
export const hppMiddleware: RequestHandler = (req, _res, next) => {
  if (req.query && typeof req.query === 'object') {
    const cleaned = { ...(req.query as Record<string, unknown>) };
    collapseArrays(cleaned);
    Object.defineProperty(req, 'query', { value: cleaned, writable: true, enumerable: true, configurable: true });
  }
  if (req.is('urlencoded') && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    collapseArrays(req.body as Record<string, unknown>);
  }
  next();
};

export const compressionMiddleware: RequestHandler = compression();

/** Max JSON/urlencoded body size accepted by the body parsers. */
export const BODY_LIMIT = '1mb';
