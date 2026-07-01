import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { env } from '@/config/env';
import {
  buildStorageKey,
  type StorageAdapter,
  type StorageSaveInput,
  type StoredObject,
} from '@/infra/storage/storage.interface';

/**
 * Local-disk backend. Bytes are streamed (never buffered whole) from multer's temp
 * file into UPLOAD_DIR/<key>. `url` is a relative path served by the static mount
 * in app.ts. Good for dev / single-host; use the S3 adapter for horizontal scale.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = 'local' as const;
  private readonly baseDir = resolve(env.UPLOAD_DIR);

  async save(input: StorageSaveInput): Promise<StoredObject> {
    const key = buildStorageKey(input.originalName, input.keyPrefix);
    const dest = join(this.baseDir, key);
    await mkdir(dirname(dest), { recursive: true });
    await pipeline(createReadStream(input.tmpPath), createWriteStream(dest));
    return {
      bucket: 'local',
      key,
      url: `/uploads/${key}`,
      filename: input.originalName,
      contentType: input.contentType,
      size: input.size,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.baseDir, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  getUrl(key: string): Promise<string> {
    return Promise.resolve(`/uploads/${key}`);
  }
}
