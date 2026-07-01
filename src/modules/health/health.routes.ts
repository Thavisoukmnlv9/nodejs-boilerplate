import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { healthController } from '@/modules/health/health.controller';

/** Mounted at the ROOT (not under /api/v1) so orchestrators can probe simply. */
export const healthRoutes = Router();

healthRoutes.get('/healthz', healthController.live);
healthRoutes.get('/readyz', asyncHandler(healthController.ready));
