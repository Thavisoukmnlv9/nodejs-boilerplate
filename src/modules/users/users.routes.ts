import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, requirePermission, validate } from '@/common/middleware';
import { usersController } from '@/modules/users/users.controller';
import { bulkUsersSchema, exportUsersQuery, inviteUserSchema, listUsersQuery, updateUserSchema, userIdParam } from '@/modules/users/users.schema';

/**
 * Mounted at /api/v1/users. The canonical module template: each route composes
 * authGuard → requirePermission(code) → validate(schema) → asyncHandler(controller).
 * NOTE: literal GET paths (/stats, /export) are declared before /:id so the param
 * route does not swallow them.
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
  '/stats',
  authGuard,
  requirePermission('platform.users.read'),
  asyncHandler(usersController.stats),
);

usersRoutes.get(
  '/export',
  authGuard,
  requirePermission('platform.users.read'),
  validate({ query: exportUsersQuery }),
  asyncHandler(usersController.exportCsv),
);

usersRoutes.post(
  '/bulk',
  authGuard,
  requirePermission('platform.users.manage'),
  validate({ body: bulkUsersSchema }),
  asyncHandler(usersController.bulk),
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

usersRoutes.post(
  '/:id/resend-invite',
  authGuard,
  requirePermission('platform.users.invite'),
  validate({ params: userIdParam }),
  asyncHandler(usersController.resendInvite),
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
