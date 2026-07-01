import { z } from 'zod';

/**
 * Plain limit/offset pagination (NOT wrapped in an envelope — the API returns
 * `{ items, total, limit, offset }` directly, per the contract). Reusable Zod
 * fragment + a shaper so every list endpoint is consistent.
 */
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const paginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type PaginationParams = z.infer<typeof paginationQuery>;

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function paginate<T>(items: T[], total: number, { limit, offset }: PaginationParams): Paginated<T> {
  return { items, total, limit, offset };
}
