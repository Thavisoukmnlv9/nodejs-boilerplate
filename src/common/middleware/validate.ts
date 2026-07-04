import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '@/common/errors';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

interface DetailIssue {
  loc: string[];
  msg: string;
  type: string;
}

/**
 * Zod validation for body/query/params. On success the PARSED (coerced, stripped)
 * value replaces the raw input, so downstream handlers get typed data. On failure
 * it throws a 422 ValidationError whose `detail` is a FastAPI-style issue array —
 * exactly what the SPA's error parser understands (`detail[i].msg`).
 */
export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    const issues: DetailIssue[] = [];

    for (const part of ['body', 'query', 'params'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      // Express 5 body-parser yields `undefined` (not `{}`) when there is no body.
      const input = part === 'body' ? (req.body ?? {}) : req[part];
      const result = schema.safeParse(input);
      if (result.success) {
        // req.query/params are getter-only in Express 5; assign the coerced value as
        // an own data property instead of writing through the (setter-less) accessor.
        Object.defineProperty(req, part, {
          value: result.data,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else {
        for (const issue of result.error.issues) {
          issues.push({ loc: [part, ...issue.path.map(String)], msg: issue.message, type: issue.code });
        }
      }
    }

    if (issues.length > 0) {
      next(new ValidationError('One or more fields are invalid.', issues));
      return;
    }
    next();
  };
