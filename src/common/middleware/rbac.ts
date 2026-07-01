import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ForbiddenError } from '@/common/errors';
import { ensureAuthContext } from '@/common/middleware/loadUserOrg';
import { roleService } from '@/modules/roles/role.service';

/**
 * Permission-code guards. A user's permissions are the union granted by their role
 * WITHIN THE CURRENT ORG (from the token's org_id) — same user, different org →
 * different permissions. The lookup is memoized per request so multiple guards on
 * one route resolve the role's permissions once.
 */
const permissionCache = new WeakMap<Request, Promise<string[]>>();

function permissionsFor(req: Request): Promise<string[]> {
  let pending = permissionCache.get(req);
  if (!pending) {
    pending = ensureAuthContext(req).then((ctx) => roleService.getPermissionCodes(ctx.membership.role_id));
    permissionCache.set(req, pending);
  }
  return pending;
}

/** 403 unless the current role includes `code`. */
export const requirePermission = (code: string): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const perms = await permissionsFor(req);
    if (!perms.includes(code)) throw new ForbiddenError(`Permission denied: ${code}`);
    next();
  });

/** 403 unless the current role includes AT LEAST ONE of `codes`. */
export const requireAnyPermission = (...codes: string[]): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const perms = await permissionsFor(req);
    if (!codes.some((code) => perms.includes(code))) {
      throw new ForbiddenError(`Permission denied: requires one of ${codes.join(', ')}`);
    }
    next();
  });
