import type { Request, Response } from 'express';
import { env } from '@/config/env';
import { checkDatabase } from '@/infra/prisma';
import { checkRedis } from '@/infra/redis';

export const healthController = {
  /** Liveness — the process is up. Cheap, no dependencies. */
  live(_req: Request, res: Response): void {
    res.json({ status: 'ok', service: env.APP_NAME, version: env.APP_VERSION });
  },

  /** Readiness — dependencies (DB + Redis) are reachable. 503 if any is down. */
  async ready(_req: Request, res: Response): Promise<void> {
    const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
    const ok = database && redis;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      checks: { database: database ? 'up' : 'down', redis: redis ? 'up' : 'down' },
    });
  },
};
