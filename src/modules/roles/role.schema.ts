import { z } from 'zod';
import { paginationQuery } from '@/common/utils/pagination';

export const listRolesQuery = paginationQuery;

export const roleIdParam = z.object({ id: z.string().min(1) });

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

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
