import { z } from 'zod';
import { paginationQuery } from '@/common/utils/pagination';
import { sortableFields } from '@/common/utils/sortableQuery';

export const POLICY_ACTIONS = ['read', 'create', 'update', 'delete', 'manage', '*'] as const;
export const POLICY_SUBJECTS = ['Branch', 'Role', 'User', 'Policy', 'Organization', '*'] as const;
export const POLICY_EFFECTS = ['ALLOW', 'DENY'] as const;
export const POLICY_SORT_FIELDS = ['effect', 'action', 'subject', 'created_at', 'updated_at'] as const;

/** A JSON object matcher, e.g. { "resource.is_main": true }. Null = unconditional. */
const conditions = z.record(z.string(), z.unknown()).nullable().optional();

const policyFilters = {
  subject: z.enum(POLICY_SUBJECTS).optional(),
  action: z.enum(POLICY_ACTIONS).optional(),
  role_id: z.string().min(1).optional(),
};

export const listPoliciesQuery = paginationQuery.extend({
  ...policyFilters,
  ...sortableFields(POLICY_SORT_FIELDS),
});

export const exportPoliciesQuery = z.object({
  ...policyFilters,
  ...sortableFields(POLICY_SORT_FIELDS),
  format: z.enum(['csv']).default('csv'),
});

export const policyIdParam = z.object({ id: z.string().min(1) });

/** Bulk actions from the policies table's selection bar. */
export const POLICY_BULK_ACTIONS = ['delete'] as const;

export const bulkPoliciesSchema = z.object({
  action: z.enum(POLICY_BULK_ACTIONS),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export const createPolicySchema = z.object({
  effect: z.enum(POLICY_EFFECTS),
  action: z.enum(POLICY_ACTIONS),
  subject: z.enum(POLICY_SUBJECTS),
  role_id: z.string().min(1).nullable().optional(),
  conditions,
  description: z.string().max(300, 'Keep the description under 300 characters').nullable().optional(),
});

export const updatePolicySchema = z
  .object({
    effect: z.enum(POLICY_EFFECTS).optional(),
    action: z.enum(POLICY_ACTIONS).optional(),
    subject: z.enum(POLICY_SUBJECTS).optional(),
    role_id: z.string().min(1).nullable().optional(),
    conditions,
    description: z.string().max(300).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export type ListPoliciesQuery = z.infer<typeof listPoliciesQuery>;
export type ExportPoliciesQuery = z.infer<typeof exportPoliciesQuery>;
export type BulkPoliciesInput = z.infer<typeof bulkPoliciesSchema>;
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
