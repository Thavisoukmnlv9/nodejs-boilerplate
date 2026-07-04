import { z } from 'zod';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const;

/** Onboarding: a freshly-registered (org-less) user creates their org and becomes Owner. */
export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(120),
  slug: z.string().trim().min(1).max(60).optional(),
  currency_code: z.enum(CURRENCIES).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(60).optional(),
  first_branch_name: z.string().trim().min(1).max(120).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
