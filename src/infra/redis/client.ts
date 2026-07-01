import { Redis } from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

/**
 * Shared Redis connection for caching (entitlements) and the rate-limit store.
 * BullMQ needs its own connection with `maxRetriesPerRequest: null` and blocking
 * commands, so queues/workers call `createQueueConnection()` instead of reusing this.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

/** Race a promise against a timeout so a probe can never block indefinitely. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref()),
  ]);
}

/** A fresh connection tuned for BullMQ (queues + workers each get their own). */
export function createQueueConnection(): Redis {
  return new Redis(env.bullmqRedisUrl, { maxRetriesPerRequest: null });
}

export async function checkRedis(): Promise<boolean> {
  try {
    const pong = await withTimeout(redis.ping(), 1500);
    return pong === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis disconnected');
}
