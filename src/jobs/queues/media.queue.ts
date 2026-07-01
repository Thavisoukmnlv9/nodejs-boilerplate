import { Queue, type ConnectionOptions } from 'bullmq';
import { QueueName } from '@/config/constants';
import { createQueueConnection } from '@/infra/redis';

/** Payload for post-upload media processing (thumbnailing, virus scan, etc.). */
export interface ProcessMediaJob {
  fileId: string;
  bucket: string;
  key: string;
  contentType: string;
}

export const mediaQueue = new Queue<ProcessMediaJob, unknown, string>(QueueName.MEDIA, {
  connection: createQueueConnection() as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
  },
});

export function enqueueProcessMedia(data: ProcessMediaJob) {
  return mediaQueue.add('process-image', data);
}
