import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, requirePermission, validate } from '@/common/middleware';
import { rolesController } from '@/modules/roles/roles.controller';
import { createRoleSchema, listRolesQuery, roleIdParam, updateRoleSchema } from '@/modules/roles/role.schema';

/** Mounted at /api/v1/roles. Lists system + org-scoped roles and manages custom roles. */
export const rolesRoutes = Router();

rolesRoutes.get(
  '/',
  authGuard,
  requirePermission('platform.roles.read'),
  validate({ query: listRolesQuery }),
  asyncHandler(rolesController.list),
);

// NOTE: /permissions MUST be registered before /:id (Express matches in order).
rolesRoutes.get(
  '/permissions',
  authGuard,
  requirePermission('platform.roles.read'),
  asyncHandler(rolesController.listPermissions),
);

rolesRoutes.get(
  '/:id',
  authGuard,
  requirePermission('platform.roles.read'),
  validate({ params: roleIdParam }),
  asyncHandler(rolesController.get),
);

rolesRoutes.post(
  '/',
  authGuard,
  requirePermission('platform.roles.manage'),
  validate({ body: createRoleSchema }),
  asyncHandler(rolesController.create),
);

rolesRoutes.patch(
  '/:id',
  authGuard,
  requirePermission('platform.roles.manage'),
  validate({ params: roleIdParam, body: updateRoleSchema }),
  asyncHandler(rolesController.update),
);

rolesRoutes.delete(
  '/:id',
  authGuard,
  requirePermission('platform.roles.manage'),
  validate({ params: roleIdParam }),
  asyncHandler(rolesController.remove),
);
