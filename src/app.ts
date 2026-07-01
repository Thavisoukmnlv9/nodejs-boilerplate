import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from '@/config/env';
import { API_PREFIX } from '@/config/constants';
import { corsOptions } from '@/config/cors';
import { setupSwagger } from '@/config/swagger';
import {
  BODY_LIMIT,
  compressionMiddleware,
  errorHandler,
  globalLimiter,
  helmetMiddleware,
  hppMiddleware,
  httpLogger,
  metricsHandler,
  metricsMiddleware,
  notFoundHandler,
  requestId,
} from '@/common/middleware';
import { apiV1Router } from '@/api';
import { healthRoutes } from '@/modules/health/health.routes';

/**
 * Builds and wires the Express app. Middleware ORDER matters and reads top-down:
 * correlate + measure + log → secure + parse → probes/docs (open) → global rate
 * limit + versioned API → 404 → error handler (always last).
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // One proxy hop (nginx) → trust it so req.ip / rate limiting see the real client.
  app.set('trust proxy', 1);

  // Correlation, metrics, structured request logs.
  app.use(requestId);
  app.use(metricsMiddleware);
  app.use(httpLogger);

  // Security & body parsing.
  app.use(helmetMiddleware);
  app.use(cors(corsOptions));
  app.use(compressionMiddleware);
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }));
  app.use(cookieParser());
  app.use(hppMiddleware);

  // Open probes + metrics (unauthenticated, not under /api/v1, not rate-limited).
  app.use(healthRoutes);
  app.get('/metrics', metricsHandler);

  // Serve locally-stored uploads (local driver only; S3 uses presigned URLs).
  if (env.STORAGE_DRIVER === 'local') {
    app.use('/uploads', express.static(env.UPLOAD_DIR, { index: false, maxAge: '1h' }));
  }

  // API docs.
  setupSwagger(app);

  // Coarse global rate limit, then the versioned API.
  app.use(API_PREFIX, globalLimiter, apiV1Router);

  // Fallthrough 404 + centralized error translation.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
