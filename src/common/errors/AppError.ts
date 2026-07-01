/**
 * Operational error hierarchy. Everything a handler `throw`s that the client
 * should see is an `AppError` subclass — the global error middleware maps it to
 * the `{ detail, code }` wire shape with the right HTTP status.
 *
 * `isOperational = true` means "expected, handled, safe to show". A bug (undefined
 * is not a function, etc.) is NOT an AppError → the handler treats it as a 500 and
 * hides internals. This is the operational-vs-programmer-error distinction.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly isOperational = true;

  /**
   * Optional structured payload. For validation errors this is the FastAPI-style
   * `detail` array; for others it may carry extra machine-readable context.
   */
  readonly details?: unknown;

  /** Extra response headers (e.g. WWW-Authenticate, Retry-After). */
  readonly headers?: Record<string, string>;

  // Public so subclasses without an explicit constructor (BadRequestError, …) can
  // be `new`ed; the class stays `abstract` so AppError itself can't be instantiated.
  constructor(message: string, options?: { details?: unknown; headers?: Record<string, string> }) {
    super(message);
    this.name = this.constructor.name;
    this.details = options?.details;
    this.headers = options?.headers;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code = 'bad_request';
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'unauthorized';
  constructor(message = 'Not authenticated', details?: unknown) {
    // Signals the SPA to attempt a token refresh.
    super(message, { details, headers: { 'WWW-Authenticate': 'Bearer' } });
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'forbidden';
  constructor(message = 'Permission denied', details?: unknown) {
    super(message, { details });
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'not_found';
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, { details });
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'conflict';
  constructor(message = 'Conflict', details?: unknown) {
    super(message, { details });
  }
}

/** 422 — request failed schema validation. `details` carries per-field issues. */
export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = 'validation_error';
  constructor(message = 'One or more fields are invalid.', details?: unknown) {
    super(message, { details });
  }
}

export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly code = 'too_many_requests';
  constructor(message = 'Too many requests', retryAfterSeconds?: number) {
    super(message, {
      details: retryAfterSeconds != null ? { retry_after_seconds: retryAfterSeconds } : undefined,
      headers: retryAfterSeconds != null ? { 'Retry-After': String(retryAfterSeconds) } : undefined,
    });
  }
}

/** 503 — a dependency (DB/Redis) is unavailable; used by readiness checks. */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = 'service_unavailable';
  constructor(message = 'Service temporarily unavailable', details?: unknown) {
    super(message, { details });
  }
}
