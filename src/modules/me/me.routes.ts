import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard } from '@/common/middleware';
import { meController } from '@/modules/me/me.controller';

/** Mounted at /api/v1/me. */
export const meRoutes = Router();

meRoutes.get('/', authGuard, asyncHandler(meController.getMe));
