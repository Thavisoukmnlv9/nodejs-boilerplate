import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, loadUserOrg, requirePermission, validate } from '@/common/middleware';
import { uploadSingle } from '@/common/middleware/upload';
import { filesController } from '@/modules/files/files.controller';

/** Mounted at /api/v1/files. */
export const filesRoutes = Router();

filesRoutes.post(
  '/',
  authGuard,
  requirePermission('platform.files.upload'),
  uploadSingle('file'),
  asyncHandler(filesController.upload),
);

filesRoutes.get(
  '/:id',
  authGuard,
  loadUserOrg,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(filesController.get),
);
