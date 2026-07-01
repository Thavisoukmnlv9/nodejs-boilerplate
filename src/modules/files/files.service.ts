import { unlink } from 'node:fs/promises';
import type { File } from '@prisma/client';
import { NotFoundError } from '@/common/errors';
import { getStorage } from '@/infra/storage';
import { type FilesRepository, filesRepository } from '@/modules/files/files.repository';
import type { FileView } from '@/modules/files/files.types';

/**
 * Persists an upload: hand the temp file to the active storage adapter, record its
 * metadata (File row), and ALWAYS clean up the temp file (even on failure). Read URLs
 * are computed per-request so S3 presigned links stay fresh. (Post-upload processing
 * like thumbnailing used to be enqueued; add it back behind a queue when needed.)
 */
export class FilesService {
  constructor(private readonly repo: FilesRepository = filesRepository) {}

  async upload(organizationId: string, userId: string, file: Express.Multer.File): Promise<FileView> {
    const storage = getStorage();
    try {
      const stored = await storage.save({
        tmpPath: file.path,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        keyPrefix: `org/${organizationId}`,
      });

      const record = await this.repo.create({
        organization_id: organizationId,
        bucket: stored.bucket,
        key: stored.key,
        filename: stored.filename,
        content_type: stored.contentType,
        size_bytes: stored.size,
        uploaded_by_id: userId,
      });

      return this.toView(record, stored.url);
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  async getMeta(organizationId: string, id: string): Promise<FileView> {
    const record = await this.repo.findById(organizationId, id);
    if (!record) throw new NotFoundError('File not found');
    const url = record.key ? await getStorage().getUrl(record.key) : '';
    return this.toView(record, url);
  }

  private toView(f: File, url: string): FileView {
    return {
      id: f.id,
      filename: f.filename,
      content_type: f.content_type,
      size_bytes: f.size_bytes,
      url,
      created_at: f.created_at.toISOString(),
    };
  }
}

export const filesService = new FilesService();
