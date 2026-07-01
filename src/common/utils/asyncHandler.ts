import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap an async route/middleware so a rejected promise reaches Express's error
 * pipeline instead of hanging the request. Controllers therefore never write
 * try/catch — they just `throw` AppErrors and let the global handler translate.
 *
 *   router.get('/x', asyncHandler(controller.get))
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
