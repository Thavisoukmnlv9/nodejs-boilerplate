import { z } from 'zod';
import { paginationQuery } from '@/common/utils/pagination';

export const POLICY_ACTIONS = ['read', 'create', 'update', 'delete', 'manage', '*'] as const;
export const POLICY_SUBJECTS = ['Branch', 'Role', 'User', 'Policy', 'Organization', '*'] as const;
export const POLICY_EFFECTS = ['ALLOW', 'DENY'] as const;

/** A JSON object matcher, e.g. { "resource.is_main": true }. Null = unconditional. */
const conditions = z.record(z.unknown()).nullable().optional();

export const listPoliciesQuery = paginationQuery.extend({
  subject: z.enum(POLICY_SUBJECTS).optional(),
  action: z.enum(POLICY_ACTIONS).optional(),
  role_id: z.string().min(1).optional(),
});

export const policyIdParam = z.object({ id: z.string().min(1) });

export const createPolicySchema = z.object({
  effect: z.enum(POLICY_EFFECTS),
  action: z.enum(POLICY_ACTIONS),
  subject: z.enum(POLICY_SUBJECTS),
  role_id: z.string().min(1).nullable().optional(),
  conditions,
  description: z.string().max(300).optional(),
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
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
