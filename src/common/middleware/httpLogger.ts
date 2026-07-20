import type { Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

/**
 * One structured log line per request, correlated by request id.
 *
 * - Terminal (dev): the pretty stream collapses each line into a single scannable
 *   entry with a colour-coded status — see `messageFormat` in `@/config/logger`.
 * - Files: compact JSON — `{ req: { method, url, query, ip, userAgent }, res:
 *   { statusCode }, responseTime, requestId }` — instead of a full header dump.
 *
 * Health/metrics probes are silenced. Secrets in the body/query/headers are
 * redacted centrally by the base logger (`redact` in `@/config/logger`).
 */

/** Cap a serialized body so a huge or binary payload can't flood the logs. */
const MAX_BODY_CHARS = 2_000;

/** Log the request body only in dev (redacted by the logger), size-capped. */
function serializeBody(body: unknown): unknown {
  if (!env.isDev || body == null) return undefined;
  if (typeof body === 'object' && Object.keys(body as object).length === 0) return undefined;
  const size = JSON.stringify(body)?.length ?? 0;
  return size > MAX_BODY_CHARS ? { _truncated: true, bytes: size } : body;
}

/** pino-http hands custom serializers the wrapped request; the raw Express request is on `.raw`. */
type WrappedReq = { raw?: Request } & Pick<Request, 'method' | 'url' | 'headers'>;

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as { id?: string }).id ?? '',
  autoLogging: {
    ignore: (req) => req.url === '/healthz' || req.url === '/readyz' || req.url === '/metrics',
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Flat, greppable correlation id + the request body. The body is captured HERE,
  // not in the req serializer, because pino-http serializes `req` at request START
  // (before express.json parses the body); customProps runs at response FINISH, when
  // the parsed body is available. The terminal hides both (see logger messageFormat).
  customProps: (req) => {
    const body = serializeBody((req as unknown as Request).body);
    const requestId = (req as { id?: string }).id;
    return body === undefined ? { requestId } : { requestId, body };
  },
  // The heart of the refactor: replace pino-http's default req/res serializers
  // (which dump every header) with a compact, chosen field set. `ip` lives on the
  // wrapped request's `.raw` (the underlying Express request) — read it from there.
  serializers: {
    req: (req: WrappedReq) => {
      const raw = req.raw;
      return {
        method: raw?.method ?? req.method,
        // Path only — the redacted `query` field carries params, so a secret in the
        // query string (e.g. ?token=…) can't leak through the raw URL.
        url: (raw?.originalUrl ?? raw?.url ?? req.url ?? '').split('?')[0],
        query: raw?.query,
        ip: raw?.ip ?? raw?.socket?.remoteAddress,
        userAgent: (raw?.headers ?? req.headers)['user-agent'],
      };
    },
    res: (res: Response) => ({ statusCode: res.statusCode }),
  },
});
