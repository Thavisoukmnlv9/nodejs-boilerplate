import type { Job } from 'bullmq';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import type { PasswordResetEmailJob } from '@/jobs/queues/email.queue';

/**
 * Sends the password-reset email. Provider is pluggable via EMAIL_PROVIDER; the
 * `console` provider (dev default) just logs the link. Throwing here triggers
 * BullMQ's configured retry/backoff. Wire SMTP/SES/Resend in the marked branch.
 */
export async function processEmailJob(job: Job<PasswordResetEmailJob>): Promise<void> {
  const { to, resetUrl } = job.data;

  switch (env.EMAIL_PROVIDER) {
    case 'smtp':
    case 'ses':
    case 'resend':
      // TODO: integrate the real provider SDK here.
      logger.warn(
        { provider: env.EMAIL_PROVIDER, to, jobId: job.id },
        'Email provider not wired in this scaffold; logging instead',
      );
      return;
    case 'console':
    default:
      logger.info({ to, resetUrl, jobId: job.id }, 'Password-reset email (console provider)');
  }
}
