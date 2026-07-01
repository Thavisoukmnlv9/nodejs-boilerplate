import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, requirePermission, validate } from '@/common/middleware';
import { paginationQuery } from '@/common/utils/pagination';
import { rolesController } from '@/modules/roles/roles.controller';

/** Mounted at /api/v1/roles. Lists system + org-scoped roles for the current org. */
export const rolesRoutes = Router();

rolesRoutes.get(
  '/',
  authGuard,
  requirePermission('platform.roles.read'),
  validate({ query: paginationQuery }),
  asyncHandler(rolesController.list),
);
