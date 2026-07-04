import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, loadUserOrg, validate } from '@/common/middleware';
import { organizationController } from '@/modules/organizations/organization.controller';
import { createOrganizationSchema } from '@/modules/organizations/organization.schema';

/** Mounted at /api/v1/organizations. */
export const organizationRoutes = Router();

// Onboarding: authGuard ONLY — the caller has no org yet, so loadUserOrg would 400.
organizationRoutes.post(
  '/',
  authGuard,
  validate({ body: createOrganizationSchema }),
  asyncHandler(organizationController.create),
);

organizationRoutes.get(
  '/current',
  authGuard,
  loadUserOrg,
  asyncHandler(async (req, res) => organizationController.current(req, res)),
);
