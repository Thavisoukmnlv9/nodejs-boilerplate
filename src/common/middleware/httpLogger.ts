import pinoHttp from 'pino-http';
import { logger } from '@/config/logger';

/**
 * One structured log line per request, correlated by request id. Health/metrics
 * probes are silenced to keep logs signal-heavy. Secret headers are already
 * redacted by the base logger config.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as { id?: string }).id ?? '',
  autoLogging: {
    ignore: (req) => req.url === '/healthz' || req.url === '/readyz' || req.url === '/metrics',
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (req) => ({ requestId: (req as { id?: string }).id }),
});
