import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

/**
 * PrismaClient singleton. In dev, tsx hot-reload would otherwise spawn a new pool
 * on every reload and exhaust Postgres connections — so we stash the instance on
 * globalThis and reuse it. Prod gets exactly one instance per process.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.isDev ? ['warn', 'error'] : ['error'],
  });

if (!env.isProd) globalForPrisma.prisma = prisma;

export async function connectPrisma(): Promise<void> {
  await prisma.$connect();
  logger.info('Prisma connected');
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
}

/** Readiness probe — cheap round-trip to confirm the DB answers (time-bounded). */
export async function checkDatabase(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000).unref()),
    ]);
    return true;
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return false;
  }
}
