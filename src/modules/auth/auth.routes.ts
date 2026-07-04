import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import {
  authGuard,
  forgotPasswordLimiter,
  loginLimiter,
  refreshLimiter,
  registerLimiter,
  validate,
} from '@/common/middleware';
import { authController } from '@/modules/auth/auth.controller';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  sessionParamsSchema,
} from '@/modules/auth/auth.schema';

/** All routes mount under /api/v1/auth. Per-route rate limits match the reference. */
export const authRoutes = Router();

authRoutes.post('/register', registerLimiter, validate({ body: registerSchema }), asyncHandler(authController.register));
authRoutes.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
authRoutes.post('/refresh', refreshLimiter, validate({ body: refreshSchema }), asyncHandler(authController.refresh));
authRoutes.post('/logout', validate({ body: logoutSchema }), asyncHandler(authController.logout));
authRoutes.post('/logout-all', authGuard, asyncHandler(authController.logoutAll));
authRoutes.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword),
);
authRoutes.post('/reset-password', validate({ body: resetPasswordSchema }), asyncHandler(authController.resetPassword));
authRoutes.post(
  '/accept-invite',
  registerLimiter,
  validate({ body: acceptInviteSchema }),
  asyncHandler(authController.acceptInvite),
);
authRoutes.get('/sessions', authGuard, asyncHandler(authController.listSessions));
authRoutes.delete(
  '/sessions/:id',
  authGuard,
  validate({ params: sessionParamsSchema }),
  asyncHandler(authController.revokeSession),
);
