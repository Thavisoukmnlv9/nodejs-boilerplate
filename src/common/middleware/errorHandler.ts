import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, BadRequestError, NotFoundError, ValidationError } from '@/common/errors';
import { logger } from '@/config/logger';

/** 404 for anything that fell through the router. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
};

/** The loosely-typed shape of the framework/library errors sniffed below. */
interface LibraryError {
  type?: string;
  status?: number;
  name?: string;
  message?: string;
  code?: string;
}

/** Zod validation failure → 422 with a FastAPI-style per-field `detail` array. */
function fromZodError(err: unknown): AppError | null {
  if (!(err instanceof ZodError)) return null;
  return new ValidationError(
    'One or more fields are invalid.',
    err.issues.map((i) => ({ loc: i.path.map(String), msg: i.message, type: i.code })),
  );
}

/** body-parser: malformed JSON (400) or an oversized body (413). */
function fromBodyParser(err: LibraryError): AppError | null {
  if (err.type === 'entity.parse.failed') return new BadRequestError('Malformed JSON body');
  if (err.type === 'entity.too.large') {
    return Object.assign(new BadRequestError('Request body too large'), { statusCode: 413, code: 'payload_too_large' });
  }
  return null;
}

/** multer upload errors: file-too-large (413) or a generic upload failure (400). */
function fromMulter(err: LibraryError): AppError | null {
  if (err.name !== 'MulterError') return null;
  const tooBig = err.code === 'LIMIT_FILE_SIZE';
  const e = new BadRequestError(tooBig ? 'File too large' : (err.message ?? 'Upload error'));
  return tooBig ? Object.assign(e, { statusCode: 413, code: 'payload_too_large' }) : e;
}

/** CORS rejection surfaced from config/cors.ts → 403. */
function fromCors(err: LibraryError): AppError | null {
  if (typeof err.message === 'string' && err.message.startsWith('Origin not allowed by CORS')) {
    return Object.assign(new BadRequestError(err.message), { statusCode: 403, code: 'forbidden' });
  }
  return null;
}

/**
 * Normalize framework/library errors into our AppError hierarchy where we can.
 * First matching source wins — the order (AppError → Zod → body-parser → multer →
 * CORS) is deliberate; an unrecognized error returns null and is treated as a 500.
 */
function normalize(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  const zodError = fromZodError(err);
  if (zodError) return zodError;
  const libErr = err as LibraryError;
  return fromBodyParser(libErr) ?? fromMulter(libErr) ?? fromCors(libErr);
}

/**
 * The single place every error becomes an HTTP response. Emits the `{ detail, code }`
 * shape the SPA expects (validation `detail` is an array; everything else a string).
 *
 * NOTE ON WIRE SHAPE: the FastAPI reference emits `{ error, message, details }`.
 * The SPA parses BOTH that and `{ detail }`, so `{ detail, code }` (the spec's
 * mandated contract) is fully compatible. To mirror the reference verbatim instead,
 * change the `body` object below — it's the only line that decides the shape.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  const appErr = normalize(err);
  const status = appErr?.statusCode ?? 500;
  const code = appErr?.code ?? 'internal_error';

  // 5xx and unknown errors are logged at full fidelity; their message is hidden
  // from the client (programmer error → don't leak internals).
  if (!appErr || status >= 500) {
    logger.error({ err, requestId: req.id, path: req.path, method: req.method }, 'Unhandled error');
  }

  const detail =
    appErr instanceof ValidationError
      ? appErr.details
      : status >= 500
        ? 'Internal server error'
        : (appErr?.message ?? 'Error');

  if (appErr?.headers) {
    for (const [k, v] of Object.entries(appErr.headers)) res.setHeader(k, v);
  }

  res.status(status).json({ detail, code });
};
