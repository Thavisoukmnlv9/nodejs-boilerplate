import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '@/common/errors';
import { verifyAccessToken } from './tokens';

/** Extract the raw Bearer token, or null when absent/malformed. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/**
 * Gate for authenticated routes. Verifies the Bearer access token and attaches a
 * typed `req.auth = { userId, orgId }`. Rejects with 401 + `WWW-Authenticate:
 * Bearer` (which tells the SPA to attempt a refresh). Stateless — no DB hit; the
 * DB context is loaded lazily by `loadUserOrg`/the permission guards.
 */
export const authGuard: RequestHandler = (req, _res, next) => {
  try {
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedError('Not authenticated');
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, orgId: payload.org_id ?? null };
    next();
  } catch (err) {
    next(err);
  }
};
