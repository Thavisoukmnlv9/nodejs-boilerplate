import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '@/config/env';
import { TooManyRequestsError } from '@/common/errors';

/**
 * Per-route rate limiting using express-rate-limit's default IN-MEMORY store.
 * Budgets match the reference service: login 5/min · register 10/hour ·
 * refresh 60/min · forgot-password 3/hour, plus a coarse global cap. Keyed by
 * client IP (needs `app.set('trust proxy', …)`).
 *
 * NOTE: the in-memory store is PER-INSTANCE. On a single host (the target deploy)
 * that's fine. If you scale to multiple app instances and need shared limits,
 * swap in a distributed store (e.g. `rate-limit-redis` or `@rate-limit/postgres`)
 * behind this same config — this is the only file that changes.
 */
const handler: Options['handler'] = (req, _res, next) => {
  const reset = (req as unknown as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
  const retryAfter = reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)) : undefined;
  next(new TooManyRequestsError('Too many requests — slow down.', retryAfter));
};

const common = { standardHeaders: 'draft-7', legacyHeaders: false, handler } satisfies Partial<Options>;

export const globalLimiter = rateLimit({ ...common, windowMs: 60_000, limit: env.RATE_LIMIT_GLOBAL_PER_MINUTE });

export const loginLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 5 });

export const registerLimiter = rateLimit({ ...common, windowMs: 60 * 60_000, limit: 10 });

export const refreshLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 60 });

export const forgotPasswordLimiter = rateLimit({ ...common, windowMs: 60 * 60_000, limit: 3 });
