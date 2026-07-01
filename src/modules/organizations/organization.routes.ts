import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, loadUserOrg } from '@/common/middleware';
import { organizationController } from '@/modules/organizations/organization.controller';

/** Mounted at /api/v1/organizations. */
export const organizationRoutes = Router();

organizationRoutes.get('/current', authGuard, loadUserOrg, asyncHandler(async (req, res) => organizationController.current(req, res)));
