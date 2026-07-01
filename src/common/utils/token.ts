import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env';
import { MANAGER_PIN_TTL_MINUTES, TokenType } from '@/config/constants';
import { UnauthorizedError } from '@/common/errors';

/**
 * HS256 JWT helpers, wire-compatible with the FastAPI reference:
 * - access  {sub, org_id?, type:"access"}   TTL 15m
 * - refresh {sub, session_id, type:"refresh"} TTL 7d
 * - reset   {sub, type:"reset"}               TTL 1h
 * - manager_pin {sub, org_id, type:"manager_pin"} TTL 5m
 *
 * Every token carries `type` so one can never be replayed as another. `iat`/`exp`
 * are added by jsonwebtoken.
 */

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  type: 'access';
  org_id?: string | null;
}
export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  type: 'refresh';
  session_id: string;
}
export interface ResetTokenPayload extends JwtPayload {
  sub: string;
  type: 'reset';
}
export interface ManagerPinTokenPayload extends JwtPayload {
  sub: string;
  type: 'manager_pin';
  org_id: string;
}

const baseOptions = { algorithm: env.JWT_ALGORITHM } satisfies SignOptions;

export function signAccessToken(userId: string, orgId: string | null): string {
  return jwt.sign({ sub: userId, type: TokenType.ACCESS, org_id: orgId }, env.JWT_SECRET, {
    ...baseOptions,
    expiresIn: env.accessTtlSec,
  });
}

export function signRefreshToken(userId: string, sessionId: string): string {
  return jwt.sign(
    { sub: userId, type: TokenType.REFRESH, session_id: sessionId },
    env.JWT_SECRET,
    { ...baseOptions, expiresIn: env.refreshTtlSec },
  );
}

export function signResetToken(userId: string): string {
  return jwt.sign({ sub: userId, type: TokenType.RESET }, env.JWT_SECRET, {
    ...baseOptions,
    expiresIn: env.resetTtlSec,
  });
}

export function signManagerPinToken(userId: string, orgId: string): string {
  return jwt.sign({ sub: userId, type: TokenType.MANAGER_PIN, org_id: orgId }, env.JWT_SECRET, {
    ...baseOptions,
    expiresIn: MANAGER_PIN_TTL_MINUTES * 60,
  });
}

/** Verify signature + expiry + `type`; throws UnauthorizedError on any failure. */
function verify<T extends JwtPayload>(token: string, expectedType: string): T {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [env.JWT_ALGORITHM] });
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
  if (typeof decoded !== 'object' || decoded === null || decoded.type !== expectedType || !decoded.sub) {
    throw new UnauthorizedError('Invalid or expired token');
  }
  return decoded as T;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return verify<AccessTokenPayload>(token, TokenType.ACCESS);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = verify<RefreshTokenPayload>(token, TokenType.REFRESH);
  if (!payload.session_id) throw new UnauthorizedError('Invalid or expired token');
  return payload;
}

export function verifyResetToken(token: string): ResetTokenPayload {
  return verify<ResetTokenPayload>(token, TokenType.RESET);
}
