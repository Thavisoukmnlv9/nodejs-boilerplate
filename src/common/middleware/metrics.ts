import client from 'prom-client';
import type { RequestHandler } from 'express';

/**
 * Prometheus metrics: default process/GC metrics + an HTTP request-duration
 * histogram. The `route` label uses the matched Express route pattern (not the raw
 * path) to keep cardinality bounded. `/metrics` is served by `metricsHandler`.
 * OpenTelemetry tracing can hook in the same request lifecycle without rework.
 */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const matched = (req.route as { path?: string } | undefined)?.path;
    const route = `${req.baseUrl ?? ''}${matched ?? ''}` || req.path;
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
};

export const metricsHandler: RequestHandler = async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
};
