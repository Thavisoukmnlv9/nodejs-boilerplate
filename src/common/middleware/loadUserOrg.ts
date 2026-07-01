import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { UnauthorizedError } from '@/common/errors';
import type { AuthContext } from '@/common/types/context';
import { organizationService } from '@/modules/organizations/organization.service';

/**
 * Resolve (user, organization, membership) once per request and memoize on `req`.
 * The RBAC guards call this internally, so a route can compose
 * `authGuard → requireModule → requirePermission` and the DB context is loaded a
 * single time. Companion to `authGuard`; must run after it.
 */
export async function ensureAuthContext(req: Request): Promise<AuthContext> {
  if (req.authContext) return req.authContext;
  if (!req.auth) throw new UnauthorizedError('Not authenticated');
  const ctx = await organizationService.loadContext(req.auth.userId, req.auth.orgId);
  req.authContext = ctx;
  return ctx;
}

/** Explicit loader for handlers that need the full (user, org, membership) context. */
export const loadUserOrg: RequestHandler = asyncHandler(async (req, _res, next) => {
  await ensureAuthContext(req);
  next();
});
