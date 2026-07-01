import { Queue, type ConnectionOptions } from 'bullmq';
import { QueueName } from '@/config/constants';
import { createQueueConnection } from '@/infra/redis';

/** Payload for the password-reset email job (enqueued by the auth flow). */
export interface PasswordResetEmailJob {
  to: string;
  resetUrl: string;
  userId: string;
}

// BullMQ bundles its own ioredis; cast our instance to its ConnectionOptions
// (runtime-compatible, the pinned type just differs from our top-level ioredis).
export const emailQueue = new Queue<PasswordResetEmailJob, unknown, string>(QueueName.EMAIL, {
  connection: createQueueConnection() as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export function enqueuePasswordResetEmail(data: PasswordResetEmailJob) {
  return emailQueue.add('password-reset', data);
}
