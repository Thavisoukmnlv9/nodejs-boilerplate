import { z } from 'zod';
import { paginationQuery } from '@/common/utils/pagination';

/** Users == organization members (the admin portal's "Users" page). */
export const listUsersQuery = paginationQuery.extend({
  q: z.string().trim().min(1).max(120).optional(),
});

export const userIdParam = z.object({
  id: z.string().min(1),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  role_id: z.string().min(1),
  branch_ids: z.array(z.string().min(1)).max(100).optional().default([]),
  default_branch_id: z.string().min(1).optional(),
  staff_title: z.string().max(120).optional(),
  staff_note: z.string().max(500).optional(),
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
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
