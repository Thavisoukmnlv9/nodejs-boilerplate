import { createReadStream } from 'node:fs';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';
import {
  buildStorageKey,
  type StorageAdapter,
  type StorageSaveInput,
  type StoredObject,
} from '@/infra/storage/storage.interface';

/**
 * S3 / S3-compatible backend (Wasabi, MinIO, Cloudflare R2…). `forcePathStyle`
 * keeps it working against non-AWS endpoints. Reads are returned as presigned GET
 * URLs (private bucket). For very large multipart uploads, swap PutObjectCommand
 * for @aws-sdk/lib-storage's `Upload`.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly driver = 's3' as const;
  private readonly bucket = env.S3_BUCKET!;
  private readonly client = new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT_URL ? { endpoint: env.S3_ENDPOINT_URL, forcePathStyle: true } : {}),
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  async save(input: StorageSaveInput): Promise<StoredObject> {
    const key = buildStorageKey(input.originalName, input.keyPrefix);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(input.tmpPath),
        ContentType: input.contentType,
        ContentLength: input.size,
      }),
    );
    return {
      bucket: this.bucket,
      key,
      url: await this.getUrl(key),
      filename: input.originalName,
      contentType: input.contentType,
      size: input.size,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: env.S3_SIGNED_URL_EXPIRE,
    });
  }
}
