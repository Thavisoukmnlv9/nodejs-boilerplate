import type { RequestHandler } from 'express';
import { UnauthorizedError } from '@/common/errors';
import { verifyAccessToken } from '@/common/utils/token';

/**
 * Gate for authenticated routes. Verifies the Bearer access token and attaches a
 * typed `req.auth = { userId, orgId }` (the Express analogue of FastAPI's
 * `Depends(get_current_user_id)`). Rejects with 401 + `WWW-Authenticate: Bearer`
 * on missing/invalid/expired tokens, which tells the SPA to attempt a refresh.
 */
export const authGuard: RequestHandler = (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Not authenticated');
    }
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    req.auth = { userId: payload.sub, orgId: payload.org_id ?? null };
    next();
  } catch (err) {
    next(err);
  }
};
