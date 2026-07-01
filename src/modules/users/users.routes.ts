import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, requirePermission, validate } from '@/common/middleware';
import { usersController } from '@/modules/users/users.controller';
import { inviteUserSchema, listUsersQuery, updateUserSchema, userIdParam } from '@/modules/users/users.schema';

/**
 * Mounted at /api/v1/users. The canonical module template: each route composes
 * authGuard → requirePermission(code) → validate(schema) → asyncHandler(controller).
 */
export const usersRoutes = Router();

usersRoutes.get(
  '/',
  authGuard,
  requirePermission('platform.users.read'),
  validate({ query: listUsersQuery }),
  asyncHandler(usersController.list),
);

usersRoutes.get(
  '/:id',
  authGuard,
  requirePermission('platform.users.read'),
  validate({ params: userIdParam }),
  asyncHandler(usersController.get),
);

usersRoutes.post(
  '/',
  authGuard,
  requirePermission('platform.users.invite'),
  validate({ body: inviteUserSchema }),
  asyncHandler(usersController.create),
);

usersRoutes.patch(
  '/:id',
  authGuard,
  requirePermission('platform.users.manage'),
  validate({ params: userIdParam, body: updateUserSchema }),
  asyncHandler(usersController.update),
);

usersRoutes.delete(
  '/:id',
  authGuard,
  requirePermission('platform.users.remove'),
  validate({ params: userIdParam }),
  asyncHandler(usersController.remove),
);
