import type { Request, Response } from 'express';
import { env } from '@/config/env';
import { checkDatabase } from '@/infra/prisma';

export const healthController = {
  /** Liveness — the process is up. Cheap, no dependencies. */
  live(_req: Request, res: Response): void {
    res.json({ status: 'ok', service: env.APP_NAME, version: env.APP_VERSION });
  },

  /** Readiness — the database is reachable. 503 if it's down. */
  async ready(_req: Request, res: Response): Promise<void> {
    const database = await checkDatabase();
    res.status(database ? 200 : 503).json({
      status: database ? 'ok' : 'degraded',
      checks: { database: database ? 'up' : 'down' },
    });
  },
};
