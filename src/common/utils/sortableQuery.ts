import { z } from 'zod';

/**
 * Reusable `{ sort?, order }` query fragment for list endpoints. Each endpoint
 * passes the whitelist of columns it is willing to sort by, so `sort` is rejected
 * at the edge (422) for anything else and the repository can trust it as a Prisma
 * `orderBy` key without opening an injection surface.
 *
 * Returned as a raw shape so callers spread it straight into `.extend({...})` /
 * `z.object({...})` alongside their own filters (avoids ZodObject `.merge`).
 */
export function sortableFields<const F extends readonly [string, ...string[]]>(fields: F) {
  return {
    sort: z.enum(fields).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  };
}

export type SortOrder = 'asc' | 'desc';

/**
 * Resolve a validated `sort`/`order` pair into a Prisma `orderBy`, mapping the
 * public column name onto its (possibly nested) Prisma path. Falls back to the
 * provided default ordering when no `sort` was supplied.
 */
export function buildOrderBy<T>(
  sort: string | undefined,
  order: SortOrder,
  map: Record<string, (dir: SortOrder) => T>,
  fallback: T[],
): T[] {
  if (sort && map[sort]) return [map[sort](order)];
  return fallback;
}
