import 'dotenv/config';
import { z } from 'zod';

/**
 * 12-factor config. The ENTIRE surface of `process.env` this app cares about is
 * declared, coerced and validated here — once, at boot. Nothing else in the
 * codebase reads `process.env` directly. A misconfigured deploy fails fast with a
 * readable message instead of exploding at the first request.
 */

/** Accept "1|true|yes|on" (case-insensitive) as true; everything else false. */
const zBool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

/** Accept a JSON array (`["a","b"]`) OR a comma-separated list (`a,b`). */
const zStringList = (def: string[]) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v == null || v.trim() === '') return def;
      const raw = v.trim();
      if (raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a JSON array or comma-separated list' });
          return z.NEVER;
        }
      }
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    });

const schema = z
  .object({
    // App
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    APP_NAME: z.string().default('Business Sync API'),
    APP_VERSION: z.string().default('0.1.0'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
    ENABLE_DOCS: zBool(false),

    // Auth / JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ALGORITHM: z.literal('HS256').default('HS256'),
    ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().int().positive().default(7),
    RESET_TOKEN_EXPIRE_HOURS: z.coerce.number().int().positive().default(1),
    REFRESH_COOKIE_NAME: z.string().default('refresh_token'),
    REFRESH_COOKIE_PATH: z.string().default('/api/v1/auth'),
    COOKIE_DOMAIN: z.string().optional(),

    // CORS
    ALLOWED_ORIGINS: zStringList(['http://localhost:3100', 'http://localhost:5173']),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Storage
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('./uploads'),
    UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().default(10),
    UPLOAD_ALLOWED_MIME: zStringList([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
    ]),
    S3_ENDPOINT_URL: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_SIGNED_URL_EXPIRE: z.coerce.number().int().positive().default(3600),

    // Email (sent inline; the console provider just logs)
    EMAIL_PROVIDER: z.enum(['console', 'smtp', 'ses', 'resend']).default('console'),
    EMAIL_FROM: z.string().default('noreply@business-sync.io'),
    WEB_BASE_URL: z.string().default('http://localhost:3100'),

    // Rate limiting
    RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().positive().default(300),
  })
  .superRefine((val, ctx) => {
    if (val.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const) {
        if (!val[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // Use console here: the logger itself depends on validated env.
  console.error(`\n✗ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const e = parsed.data;

export const env = {
  ...e,
  // Derived, computed once.
  isProd: e.NODE_ENV === 'production',
  isDev: e.NODE_ENV === 'development',
  isTest: e.NODE_ENV === 'test',
  cookieSecure: e.NODE_ENV === 'production',
  accessTtlSec: e.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
  refreshTtlSec: e.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
  resetTtlSec: e.RESET_TOKEN_EXPIRE_HOURS * 60 * 60,
  uploadMaxBytes: Math.floor(e.UPLOAD_MAX_SIZE_MB * 1024 * 1024),
} as const;

export type Env = typeof env;
