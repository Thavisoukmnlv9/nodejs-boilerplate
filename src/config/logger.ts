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
 * - always → daily-rotated files under logs/: app-YYYY-MM-DD.log (all levels)
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
      // Compact request-log shape (see httpLogger): body is a top-level field and
      // query sits under req; the '*.password' wildcards below are depth-2 and never
      // reach body.*/req.query.*, so list those leaf paths explicitly.
      'body.password',
      'body.new_password',
      'body.current_password',
      'body.token',
      'body.access_token',
      'body.refresh_token',
      'body.pin',
      'req.query.token',
      'req.query.access_token',
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

/**
 * Colour a status code for the terminal: green 2xx · cyan 3xx · yellow 4xx ·
 * red 5xx. Raw ANSI (dev stream only), independent of pino-pretty's level colour.
 */
const statusColor = (status: number): string => {
  const code = status >= 500 ? 31 : status >= 400 ? 33 : status >= 300 ? 36 : 32;
  return `\x1b[${code}m${status}\x1b[0m`;
};

const consoleStream = env.isDev
  ? pretty({
      colorize: true,
      translateTime: 'SYS:HH:MM:ss', // → [18:14:17]
      // Hide the structured payload from the terminal (files still get full JSON),
      // but KEEP `err` so error stacks print clearly below their line.
      ignore: 'pid,hostname,service,env,req,res,responseTime,requestId,body',
      // Request logs collapse to one scannable line; everything else keeps its message.
      messageFormat: (log, messageKey) => {
        const req = log.req as { method?: string; url?: string } | undefined;
        const res = log.res as { statusCode?: number } | undefined;
        if (req && res) {
          const reqId = String(log.requestId ?? '').slice(0, 8);
          return `${req.method} ${req.url} ${statusColor(res.statusCode ?? 0)} · ${log.responseTime}ms · reqId=${reqId}`;
        }
        return String(log[messageKey] ?? '');
      },
    })
  : process.stdout;

// Per-stream levels must be a concrete pino Level; overall gating (incl. 'silent')
// is handled by `options.level` on the logger itself.
const streamLevel = (env.LOG_LEVEL === 'silent' ? 'trace' : env.LOG_LEVEL) as pino.Level;

const streams: pino.StreamEntry[] = [
  { level: streamLevel, stream: consoleStream as NodeJS.WritableStream },
  { level: streamLevel, stream: new DailyRotatingStream('app') as unknown as NodeJS.WritableStream },
  { level: 'error', stream: new DailyRotatingStream('error') as unknown as NodeJS.WritableStream },
];

export const logger = pino(options, pino.multistream(streams, { dedupe: false }));

export type Logger = typeof logger;
