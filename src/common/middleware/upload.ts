import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import multer from 'multer';
import type { RequestHandler } from 'express';
import { env } from '@/config/env';
import { BadRequestError } from '@/common/errors';

/**
 * Multer configured for safe uploads: bytes stream to a temp dir (never buffered
 * in memory), an allowlist gates MIME type, and a hard size cap is enforced. The
 * feature service then hands the temp file to the storage adapter and deletes it.
 * Oversize / MulterError cases are translated by the global error handler.
 */
const TMP_DIR = join(tmpdir(), 'boilerplate-uploads');
mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
});

const allowed = new Set(env.UPLOAD_ALLOWED_MIME);

const upload = multer({
  storage,
  limits: { fileSize: env.uploadMaxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

/** Accept exactly one file under `field` (default "file"). */
export const uploadSingle = (field = 'file'): RequestHandler => upload.single(field);
