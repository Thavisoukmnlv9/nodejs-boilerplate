import { Router } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { authGuard, requirePermission, validate } from '@/common/middleware';
import { policiesController } from '@/modules/policies/policies.controller';
import { bulkPoliciesSchema, createPolicySchema, exportPoliciesQuery, listPoliciesQuery, policyIdParam, updatePolicySchema } from '@/modules/policies/policy.schema';

/** Mounted at /api/v1/policies. Manages the org's stored ABAC policies. */
export const policiesRoutes = Router();

policiesRoutes.get(
  '/',
  authGuard,
  requirePermission('platform.policies.read'),
  validate({ query: listPoliciesQuery }),
  asyncHandler(policiesController.list),
);

// NOTE: literal GET paths (/stats, /export, /condition-schema) MUST precede /:id.
policiesRoutes.get(
  '/stats',
  authGuard,
  requirePermission('platform.policies.read'),
  asyncHandler(policiesController.stats),
);

policiesRoutes.get(
  '/condition-schema',
  authGuard,
  requirePermission('platform.policies.read'),
  asyncHandler(policiesController.conditionSchema),
);

policiesRoutes.get(
  '/export',
  authGuard,
  requirePermission('platform.policies.read'),
  validate({ query: exportPoliciesQuery }),
  asyncHandler(policiesController.exportCsv),
);

policiesRoutes.post(
  '/bulk',
  authGuard,
  requirePermission('platform.policies.manage'),
  validate({ body: bulkPoliciesSchema }),
  asyncHandler(policiesController.bulk),
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
