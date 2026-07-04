import type { Request } from 'express';
import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, requirePermission, requirePolicy, validate } from '@/common/middleware';
import type { AuthContext } from '@/common/types/context';
import { branchesController } from '@/modules/branches/branches.controller';
import { branchRepository } from '@/modules/branches/branch.repository';
import { branchIdParam, createBranchSchema, listBranchesQuery, updateBranchSchema } from '@/modules/branches/branch.schema';

/** Mounted at /api/v1/branches. List is branch-scope clamped; mutations pass through
 *  requirePermission (RBAC gate) AND requirePolicy (ABAC refinement — e.g. the demo
 *  policy that forbids deleting the main branch). */
export const branchesRoutes = Router();

/** Loads the target branch so requirePolicy can evaluate conditions against it. */
const loadBranch = (req: Request, ctx: AuthContext): Promise<Record<string, unknown> | null> =>
  branchRepository.findInOrg(ctx.organization.id, req.params.id!) as Promise<Record<string, unknown> | null>;

branchesRoutes.get(
  '/',
  authGuard,
  requirePermission('platform.branches.read'),
  validate({ query: listBranchesQuery }),
  asyncHandler(branchesController.list),
);

branchesRoutes.get(
  '/:id',
  authGuard,
  requirePermission('platform.branches.read'),
  validate({ params: branchIdParam }),
  asyncHandler(branchesController.get),
);

branchesRoutes.post(
  '/',
  authGuard,
  requirePermission('platform.branches.manage'),
  validate({ body: createBranchSchema }),
  asyncHandler(branchesController.create),
);

branchesRoutes.patch(
  '/:id',
  authGuard,
  requirePermission('platform.branches.manage'),
  validate({ params: branchIdParam, body: updateBranchSchema }),
  requirePolicy('update', 'Branch', loadBranch),
  asyncHandler(branchesController.update),
);

branchesRoutes.delete(
  '/:id',
  authGuard,
  requirePermission('platform.branches.delete'),
  validate({ params: branchIdParam }),
  requirePolicy('delete', 'Branch', loadBranch),
  asyncHandler(branchesController.remove),
);
