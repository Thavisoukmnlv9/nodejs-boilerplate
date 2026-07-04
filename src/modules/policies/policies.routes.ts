import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, requirePermission, validate } from '@/common/middleware';
import { policiesController } from '@/modules/policies/policies.controller';
import { createPolicySchema, listPoliciesQuery, policyIdParam, updatePolicySchema } from '@/modules/policies/policy.schema';

/** Mounted at /api/v1/policies. Manages the org's stored ABAC policies. */
export const policiesRoutes = Router();

policiesRoutes.get(
  '/',
  authGuard,
  requirePermission('platform.policies.read'),
  validate({ query: listPoliciesQuery }),
  asyncHandler(policiesController.list),
);

policiesRoutes.get(
  '/:id',
  authGuard,
  requirePermission('platform.policies.read'),
  validate({ params: policyIdParam }),
  asyncHandler(policiesController.get),
);

policiesRoutes.post(
  '/',
  authGuard,
  requirePermission('platform.policies.manage'),
  validate({ body: createPolicySchema }),
  asyncHandler(policiesController.create),
);

policiesRoutes.patch(
  '/:id',
  authGuard,
  requirePermission('platform.policies.manage'),
  validate({ params: policyIdParam, body: updatePolicySchema }),
  asyncHandler(policiesController.update),
);

policiesRoutes.delete(
  '/:id',
  authGuard,
  requirePermission('platform.policies.manage'),
  validate({ params: policyIdParam }),
  asyncHandler(policiesController.remove),
);
