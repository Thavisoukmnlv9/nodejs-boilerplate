import { randomUUID } from 'node:crypto';

/** What the caller hands the adapter (multer wrote the bytes to `tmpPath`). */
export interface StorageSaveInput {
  tmpPath: string;
  originalName: string;
  contentType: string;
  size: number;
  /** Logical prefix, e.g. `org/<id>`; the adapter adds date + uuid segments. */
  keyPrefix?: string;
}

/** Normalized metadata returned by every adapter, persisted to the File table. */
export interface StoredObject {
  bucket: string;
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

/**
 * Pluggable storage. Swapping local ⇄ S3 is a one-line env change; nothing in the
 * files feature knows which backend it's talking to.
 */
export interface StorageAdapter {
  readonly driver: 'local' | 's3';
  save(input: StorageSaveInput): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

/** Strip path separators / control chars so an upload name can't traverse dirs. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return (
    base
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 200) || 'file'
  );
}

/** `org/<id>/2026/07/<uuid>-name.png` — collision-free, sortable, sanitized. */
export function buildStorageKey(originalName: string, keyPrefix?: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safe = sanitizeFilename(originalName);
  const prefix = keyPrefix ? `${keyPrefix.replace(/\/+$/, '')}/` : '';
  return `${prefix}${yyyy}/${mm}/${randomUUID()}-${safe}`;
}
