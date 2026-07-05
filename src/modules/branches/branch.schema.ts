import { z } from 'zod';
import { paginationQuery } from '@/common/utils/pagination';
import { sortableFields } from '@/common/utils/sortableQuery';

export const BRANCH_VERTICALS = ['GENERAL', 'RETAIL', 'SERVICE'] as const;
export const BRANCH_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const;
export const BRANCH_SORT_FIELDS = ['name', 'code', 'vertical', 'is_active', 'created_at', 'updated_at'] as const;

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,12}$/, 'Code must be 2–12 chars: A–Z, 0–9, hyphen');

const bps = z.number().int().min(0).max(5000);

const timezone = z.string().refine((tz) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Invalid IANA timezone');

/** Query-string booleans: only literal "true"/"false" (z.coerce.boolean treats "false" as true). */
const queryBool = z.union([z.literal('true'), z.literal('false')]).transform((v) => v === 'true');

const branchFilters = {
  q: z.string().trim().min(1).max(120).optional(),
  is_active: queryBool.optional(),
  vertical: z.enum(BRANCH_VERTICALS).optional(),
  branch_id: z.string().min(1).optional(),
};

export const listBranchesQuery = paginationQuery.extend({
  ...branchFilters,
  ...sortableFields(BRANCH_SORT_FIELDS),
});

export const exportBranchesQuery = z.object({
  ...branchFilters,
  ...sortableFields(BRANCH_SORT_FIELDS),
  format: z.enum(['csv']).default('csv'),
});

export const branchIdParam = z.object({ id: z.string().min(1) });

/** Bulk actions from the branches table's selection bar. */
export const BRANCH_BULK_ACTIONS = ['archive', 'activate', 'delete'] as const;

export const bulkBranchesSchema = z.object({
  action: z.enum(BRANCH_BULK_ACTIONS),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Keep the name under 120 characters'),
  code: code.nullable().optional(),
  address: z.string().max(300, 'Keep the address under 300 characters').nullable().optional(),
  type: z.string().max(60, 'Keep the type under 60 characters').nullable().optional(),
  vertical: z.enum(BRANCH_VERTICALS).nullable().optional(),
  phone: z.string().max(40, 'Keep the phone under 40 characters').nullable().optional(),
  email: z.email('Enter a valid email address').nullable().optional(),
  timezone: timezone.optional(),
  currency_code: z.enum(BRANCH_CURRENCIES).optional(),
  locale: z.string().max(10).optional(),
  tax_rate_bps: bps.optional(),
  service_fee_bps: bps.optional(),
  prices_include_tax: z.boolean().optional(),
});

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    code: code.nullable().optional(),
    address: z.string().max(300).nullable().optional(),
    type: z.string().max(60).nullable().optional(),
    vertical: z.enum(BRANCH_VERTICALS).nullable().optional(),
    is_active: z.boolean().optional(),
    is_main: z.boolean().optional(), // true = promote (swap); false = rejected by the service
    phone: z.string().max(40).nullable().optional(),
    email: z.email().nullable().optional(),
    timezone: timezone.optional(),
    currency_code: z.enum(BRANCH_CURRENCIES).optional(),
    locale: z.string().max(10).optional(),
    tax_rate_bps: bps.optional(),
    service_fee_bps: bps.optional(),
    prices_include_tax: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export type ListBranchesQuery = z.infer<typeof listBranchesQuery>;
export type ExportBranchesQuery = z.infer<typeof exportBranchesQuery>;
export type BulkBranchesInput = z.infer<typeof bulkBranchesSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
