import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/infra/prisma/client';

/**
 * Base for all repositories. Repositories are the ONLY layer that touches Prisma —
 * controllers and services never import the client. Subclasses receive the shared
 * client (or a transaction client) and get the soft-delete conventions for free:
 * every domain table has `deleted_at`, so reads filter it out and deletes set it.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: Prisma.TransactionClient = prisma) {}

  /** Spread into a `where` to exclude soft-deleted rows: `{ ...this.notDeleted }`. */
  protected get notDeleted(): { deleted_at: null } {
    return { deleted_at: null };
  }

  /** Patch that soft-deletes a row. */
  protected softDeletePatch(): { deleted_at: Date } {
    return { deleted_at: new Date() };
  }
}
