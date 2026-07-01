import { env } from '@/config/env';
import { logger } from '@/config/logger';

/**
 * Transactional email, sent inline (no queue). Provider is pluggable via
 * EMAIL_PROVIDER; the `console` provider (dev default) logs the link. Callers
 * should not let a send failure surface to the client (e.g. the password-reset
 * flow swallows errors to avoid account enumeration). Wire SMTP/SES/Resend in the
 * marked branch — and if delivery ever gets slow/unreliable, reintroduce an async
 * queue (BullMQ/pg-boss) behind this same interface.
 */
export interface PasswordResetEmail {
  to: string;
  resetUrl: string;
  userId: string;
}

export async function sendPasswordResetEmail(msg: PasswordResetEmail): Promise<void> {
  switch (env.EMAIL_PROVIDER) {
    case 'smtp':
    case 'ses':
    case 'resend':
      // TODO: integrate the real provider SDK here.
      logger.warn(
        { provider: env.EMAIL_PROVIDER, to: msg.to },
        'Email provider not wired in this scaffold; logging instead',
      );
      return;
    case 'console':
    default:
      logger.info({ to: msg.to, resetUrl: msg.resetUrl }, 'Password-reset email (console provider)');
  }
}
