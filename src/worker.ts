import { logger } from '@/config/logger';
import { connectPrisma, disconnectPrisma } from '@/infra/prisma';
import { disconnectRedis } from '@/infra/redis';
import { startWorkers } from '@/jobs/workers';

/**
 * Background worker entrypoint — a SEPARATE process from the API (`npm run worker`,
 * its own container in docker-compose). Consuming jobs here keeps request latency
 * isolated and lets workers scale independently of the web tier.
 */
async function bootstrap(): Promise<void> {
  await connectPrisma();
  const workers = startWorkers();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Worker shutting down');
    void (async () => {
      await Promise.allSettled(workers.map((w) => w.close()));
      await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
      logger.info('Worker shutdown complete');
      process.exit(0);
    })();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Worker uncaught exception — exiting');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
