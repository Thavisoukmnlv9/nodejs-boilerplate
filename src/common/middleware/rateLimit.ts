import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '@/infra/redis';
import { env } from '@/config/env';
import { TooManyRequestsError } from '@/common/errors';

/**
 * Redis-backed rate limiting so limits hold ACROSS instances (the app is stateless
 * and horizontally scaled). Per-route budgets match the reference service:
 * login 5/min · register 10/hour · refresh 60/min · forgot-password 3/hour, plus a
 * coarse global cap. Keyed by client IP (needs `app.set('trust proxy', …)`).
 */
function makeStore(prefix: string): RedisStore {
  return new RedisStore({
    prefix,
    // ioredis' generic command runner, adapted to rate-limit-redis' sendCommand.
    sendCommand: (...args: string[]) =>
      (redis as unknown as { call: (...a: string[]) => Promise<unknown> }).call(...args) as Promise<never>,
  });
}

const handler: Options['handler'] = (req, _res, next) => {
  const reset = (req as unknown as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
  const retryAfter = reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)) : undefined;
  next(new TooManyRequestsError('Too many requests — slow down.', retryAfter));
};

const common = { standardHeaders: 'draft-7', legacyHeaders: false, handler } satisfies Partial<Options>;

export const globalLimiter = rateLimit({
  ...common,
  windowMs: 60_000,
  limit: env.RATE_LIMIT_GLOBAL_PER_MINUTE,
  store: makeStore('rl:global:'),
});

export const loginLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 5, store: makeStore('rl:login:') });

export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60_000,
  limit: 10,
  store: makeStore('rl:register:'),
});

export const refreshLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 60, store: makeStore('rl:refresh:') });

export const forgotPasswordLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60_000,
  limit: 3,
  store: makeStore('rl:forgot:'),
});
