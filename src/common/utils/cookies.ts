import type { CookieOptions, Request, Response } from 'express';
import { env } from '@/config/env';

/**
 * Refresh-token cookie handling, matching the reference service exactly:
 * httpOnly, Secure (prod only), SameSite=strict, scoped to the auth path so it is
 * never sent to non-auth routes. Name/path come from env (default `refresh_token`
 * @ `/api/v1/auth`).
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: env.REFRESH_COOKIE_PATH,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(env.REFRESH_COOKIE_NAME, token, { ...cookieOptions(), maxAge: env.refreshTtlSec * 1000 });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions());
}

/** Cookie-first, then JSON body (mobile/legacy clients). */
export function readRefreshToken(req: Request, bodyToken?: string | null): string | null {
  const cookie = (req.cookies as Record<string, string | undefined> | undefined)?.[env.REFRESH_COOKIE_NAME];
  return cookie ?? bodyToken ?? null;
}
