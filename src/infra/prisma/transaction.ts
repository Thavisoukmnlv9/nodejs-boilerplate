import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/infra/prisma/client';

/**
 * Run `fn` inside a single DB transaction. Anything thrown rolls back. Pass the
 * provided `tx` client to repositories (each repo constructor accepts one) so all
 * their writes join the same transaction.
 *
 *   await withTransaction(async (tx) => {
 *     const users = new UserRepository(tx);
 *     const sessions = new SessionRepository(tx);
 *     ...
 *   });
 */
export function withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
