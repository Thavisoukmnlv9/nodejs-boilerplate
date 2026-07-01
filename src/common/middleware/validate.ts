import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '@/common/errors';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
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
      const result = schema.safeParse(req[part]);
      if (result.success) {
        // Express 4's req.query/params are writable — assign back the coerced value.
        (req as unknown as Record<string, unknown>)[part] = result.data;
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
