import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { runWithRequestContext } from '@/common/utils/requestContext';

/**
 * Assigns/propagates a correlation id. Honors an inbound `X-Request-Id` (set by an
 * upstream gateway) or mints one, echoes it on the response, and binds it into
 * AsyncLocalStorage so deep service code can log it without plumbing.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  const id = (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  runWithRequestContext({ requestId: id }, () => next());
};
