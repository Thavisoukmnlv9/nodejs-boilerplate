import type { RequestHandler } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { ForbiddenError } from '@/common/errors';
import { ensureAuthContext } from '@/common/middleware/loadUserOrg';
import { entitlementService } from '@/modules/entitlements/entitlement.service';

/**
 * Subscription gate: 403 unless the org's entitlements enable `moduleCode`. This is
 * orthogonal to permissions — compose both (subscription gate + role gate):
 *
 *   router.post('/orders', authGuard, requireModule('pos_shop'),
 *     requirePermission('pos_shop.sell'), asyncHandler(orderController.create));
 */
export const requireModule = (moduleCode: string): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const ctx = await ensureAuthContext(req);
    if (!(await entitlementService.canUseModule(ctx.organization.id, moduleCode))) {
      throw new ForbiddenError(`Module not enabled: ${moduleCode}`);
    }
    next();
  });
