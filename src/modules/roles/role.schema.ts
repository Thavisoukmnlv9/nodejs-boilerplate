import { z } from 'zod';
import { paginationQuery } from '@/common/utils/pagination';
import { sortableFields } from '@/common/utils/sortableQuery';

/** Columns the roles list may be sorted by (member/permission counts are computed → excluded). */
export const ROLE_SORT_FIELDS = ['name', 'created_at', 'is_system'] as const;

const roleFilters = {
  q: z.string().trim().min(1).max(120).optional(),
};

export const listRolesQuery = paginationQuery.extend({
  ...roleFilters,
  ...sortableFields(ROLE_SORT_FIELDS),
});

export const exportRolesQuery = z.object({
  ...roleFilters,
  ...sortableFields(ROLE_SORT_FIELDS),
  format: z.enum(['csv']).default('csv'),
});

export const roleIdParam = z.object({ id: z.string().min(1) });

/** Bulk actions from the roles table (custom roles only; system/in-use are skipped). */
export const ROLE_BULK_ACTIONS = ['delete'] as const;

export const bulkRolesSchema = z.object({
  action: z.enum(ROLE_BULK_ACTIONS),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().max(300).optional(),
  permission_codes: z.array(z.string().min(1)).max(500).optional().default([]),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(300).nullable().optional(),
    permission_codes: z.array(z.string().min(1)).max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export type ListRolesQuery = z.infer<typeof listRolesQuery>;
export type ExportRolesQuery = z.infer<typeof exportRolesQuery>;
export type BulkRolesInput = z.infer<typeof bulkRolesSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
