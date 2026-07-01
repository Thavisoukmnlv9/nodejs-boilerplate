import type { Server } from 'node:http';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { connectPrisma, disconnectPrisma } from '@/infra/prisma';

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function bootstrap(): Promise<void> {
  await connectPrisma();
  const app = createApp();

  const server: Server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `${env.APP_NAME} listening on :${env.PORT}`);
  });

  installLifecycleHandlers(server);
}

/**
 * Graceful shutdown: stop accepting connections, drain in-flight requests, then
 * close the DB. A hard timeout guarantees the process exits even if something hangs.
 * The app is otherwise stateless, so restarts/scale events are safe.
 */
function installLifecycleHandlers(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    const forced = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forced.unref();

    server.close(() => {
      void (async () => {
        await disconnectPrisma();
        logger.info('Shutdown complete');
        process.exit(0);
      })();
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
