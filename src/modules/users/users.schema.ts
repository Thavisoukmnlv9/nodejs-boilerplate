import { z } from 'zod';
import { paginationQuery } from '@/common/utils/pagination';
import { sortableFields } from '@/common/utils/sortableQuery';

/** Users == organization members (the admin portal's "Users" page). */
export const MEMBER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] as const;

/** Columns the members list may be sorted by (whitelist → safe Prisma orderBy). */
export const USER_SORT_FIELDS = ['name', 'email', 'status', 'invited_at'] as const;

/** Shared filter shape reused by the list and export endpoints. */
const userFilters = {
  q: z.string().trim().min(1).max(120).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  role_id: z.string().min(1).optional(),
};

export const listUsersQuery = paginationQuery.extend({
  ...userFilters,
  ...sortableFields(USER_SORT_FIELDS),
});

export const exportUsersQuery = z.object({
  ...userFilters,
  ...sortableFields(USER_SORT_FIELDS),
  format: z.enum(['csv']).default('csv'),
});

export const userIdParam = z.object({ id: z.string().min(1) });

/** Bulk actions from the members table's selection bar. */
export const USER_BULK_ACTIONS = ['remove', 'resend_invite', 'set_role'] as const;

export const bulkUsersSchema = z
  .object({
    action: z.enum(USER_BULK_ACTIONS),
    ids: z.array(z.string().min(1)).min(1).max(200),
    role_id: z.string().min(1).optional(),
  })
  .refine((v) => v.action !== 'set_role' || !!v.role_id, {
    message: 'role_id is required when action is set_role',
    path: ['role_id'],
  });

export const inviteUserSchema = z.object({
  email: z.email('Enter a valid email address'),
  name: z.string().max(120, 'Keep the name under 120 characters').optional(),
  role_id: z.string().min(1, 'Select a role'),
  branch_ids: z.array(z.string().min(1)).max(100).optional().default([]),
  default_branch_id: z.string().min(1).nullable().optional(),
  staff_title: z.string().max(120, 'Keep the title under 120 characters').nullable().optional(),
  staff_note: z.string().max(500, 'Keep notes under 500 characters').nullable().optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().max(120).optional(),
    role_id: z.string().min(1).optional(),
    branch_ids: z.array(z.string().min(1)).max(100).optional(),
    default_branch_id: z.string().min(1).nullable().optional(),
    staff_title: z.string().max(120).nullable().optional(),
    staff_note: z.string().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type ExportUsersQuery = z.infer<typeof exportUsersQuery>;
export type BulkUsersInput = z.infer<typeof bulkUsersSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
