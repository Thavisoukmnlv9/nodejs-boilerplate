import { env } from '@/config/env';
import { LocalStorageAdapter } from '@/infra/storage/local.adapter';
import { S3StorageAdapter } from '@/infra/storage/s3.adapter';
import type { StorageAdapter } from '@/infra/storage/storage.interface';

let instance: StorageAdapter | null = null;

/** Lazily construct the adapter chosen by STORAGE_DRIVER; reused thereafter. */
export function getStorage(): StorageAdapter {
  if (!instance) {
    instance = env.STORAGE_DRIVER === 's3' ? new S3StorageAdapter() : new LocalStorageAdapter();
  }
  return instance;
}

export * from '@/infra/storage/storage.interface';
