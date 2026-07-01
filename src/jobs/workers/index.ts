import { Worker, type ConnectionOptions } from 'bullmq';
import { QueueName } from '@/config/constants';
import { logger } from '@/config/logger';
import { createQueueConnection } from '@/infra/redis';
import { processEmailJob } from '@/jobs/processors/email.processor';
import { processMediaJob } from '@/jobs/processors/media.processor';
import type { PasswordResetEmailJob } from '@/jobs/queues/email.queue';
import type { ProcessMediaJob } from '@/jobs/queues/media.queue';

/**
 * Bootstraps the workers. Runs in a SEPARATE process (`npm run worker` /
 * src/worker.ts) so heavy background work never competes with request latency and
 * scales independently. Each worker gets its own Redis connection.
 */
export function startWorkers(): Worker[] {
  const email = new Worker<PasswordResetEmailJob, unknown, string>(QueueName.EMAIL, processEmailJob, {
    connection: createQueueConnection() as unknown as ConnectionOptions,
    concurrency: 5,
  });
  const media = new Worker<ProcessMediaJob, unknown, string>(QueueName.MEDIA, processMediaJob, {
    connection: createQueueConnection() as unknown as ConnectionOptions,
    concurrency: 3,
  });

  const workers = [email, media];
  for (const w of workers) {
    w.on('failed', (job, err) => logger.error({ err, jobId: job?.id, queue: w.name }, 'Job failed'));
    w.on('completed', (job) => logger.debug({ jobId: job.id, queue: w.name }, 'Job completed'));
    w.on('error', (err) => logger.error({ err, queue: w.name }, 'Worker error'));
  }

  logger.info({ queues: workers.map((w) => w.name) }, 'BullMQ workers started');
  return workers;
}
