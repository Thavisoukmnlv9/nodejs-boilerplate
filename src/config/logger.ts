import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import pino, { type LoggerOptions } from 'pino';
import pretty from 'pino-pretty';
import { env } from '@/config/env';

/**
 * The single logger for the whole service. Never `console.log` in app code.
 *
 * - dev  → pretty, colorized, to stdout
 * - prod → structured JSON to stdout (for the container log driver)
 * - always → daily-rotated files under logs/: combined-YYYY-MM-DD.log (all levels)
 *   and error-YYYY-MM-DD.log (error+). Files roll when the UTC date changes; keep
 *   a supervisor (logrotate / docker json-file max-size) for hard disk caps.
 *
 * Secrets, tokens and PII are redacted centrally (see `redact` below).
 */

const LOG_DIR = 'logs';

/** A tiny append stream that reopens itself when the calendar day changes. */
class DailyRotatingStream {
  private day = DailyRotatingStream.today();
  private stream: WriteStream;

  constructor(private readonly prefix: string) {
    mkdirSync(LOG_DIR, { recursive: true });
    this.stream = this.open();
  }

  private static today(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  }

  private open(): WriteStream {
    return createWriteStream(join(LOG_DIR, `${this.prefix}-${this.day}.log`), { flags: 'a' });
  }

  write(chunk: string): void {
    const now = DailyRotatingStream.today();
    if (now !== this.day) {
      this.stream.end();
      this.day = now;
      this.stream = this.open();
    }
    this.stream.write(chunk);
  }
}

const options: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: env.APP_NAME, env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Defense-in-depth: even if someone logs a whole request/user, secrets vanish.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.password_hash',
      '*.pin_hash',
      '*.refresh_token',
      '*.access_token',
      '*.token',
      '*.new_password',
      'password',
      'password_hash',
      'refresh_token_hash',
    ],
    censor: '[redacted]',
  },
};

const consoleStream = env.isDev
  ? pretty({ colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname,service,env' })
  : process.stdout;

// Per-stream levels must be a concrete pino Level; overall gating (incl. 'silent')
// is handled by `options.level` on the logger itself.
const streamLevel = (env.LOG_LEVEL === 'silent' ? 'trace' : env.LOG_LEVEL) as pino.Level;

const streams: pino.StreamEntry[] = [
  { level: streamLevel, stream: consoleStream as NodeJS.WritableStream },
  { level: streamLevel, stream: new DailyRotatingStream('combined') as unknown as NodeJS.WritableStream },
  { level: 'error', stream: new DailyRotatingStream('error') as unknown as NodeJS.WritableStream },
];

export const logger = pino(options, pino.multistream(streams, { dedupe: false }));

export type Logger = typeof logger;
