import type { Job } from 'bullmq';
import { logger } from '@/config/logger';
import type { ProcessMediaJob } from '@/jobs/queues/media.queue';

/**
 * Post-upload media processing. Realistic home for thumbnail generation, EXIF
 * stripping, or an AV scan. Stubbed here (logs + would update the File row); the
 * point is to show the enqueue → worker → retry pipeline end to end.
 */
export async function processMediaJob(job: Job<ProcessMediaJob>): Promise<void> {
  logger.info({ jobId: job.id, fileId: job.data.fileId, key: job.data.key }, 'Processing uploaded media');
  // e.g. download from storage → sharp().resize() → upload thumbnail → update File.
}
