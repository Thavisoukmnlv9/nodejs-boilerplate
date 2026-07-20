import { networkInterfaces } from 'node:os';
import { env } from '@/config/env';

/**
 * Pretty boot summary, printed once to stdout after the server starts listening.
 *
 * This is the one place besides env.ts that writes to stdout directly instead of
 * through the pino logger: a banner must render as a clean block, with no per-line
 * timestamp/level prefix. Presentation only. The DB password is masked before print.
 */

// ANSI colour — only when writing to a real dev terminal. Piping `npm run dev`
// to a file or CI (or setting NO_COLOR) strips it so no raw escape codes leak;
// FORCE_COLOR re-enables it for pipelines that do render ANSI. This banner and
// env.ts are the only deliberate readers of process.env — colour is a terminal
// signal, not app config.
const useColor =
  env.isDev &&
  !process.env.NO_COLOR &&
  (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR));
const paint = (code: string, s: string): string => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string): string => paint('1', s);
const dim = (s: string): string => paint('2', s);
const cyan = (s: string): string => paint('36', s);
const green = (s: string): string => paint('32', s);
const yellow = (s: string): string => paint('33', s);
const red = (s: string): string => paint('31', s);

/** Environment name, colour-coded: green dev · yellow test · red prod. */
function envBadge(name: string): string {
  if (name === 'production') return red(name);
  if (name === 'test') return yellow(name);
  return green(name);
}

/** First non-internal IPv4 address — the Vite-style "Network" URL (null if none). */
function lanAddress(): string | null {
  for (const iface of Object.values(networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

/**
 * Render a DB connection string safely for display: `scheme://user:••••@host:port/db`.
 * The password is masked and the query string is dropped — it's noise here and can
 * carry secrets (e.g. `?sslpassword=`). Falls back to a plain password mask if the
 * URL can't be parsed.
 */
function maskDbUrl(url: string): string {
  try {
    const u = new URL(url);
    const port = u.port ? `:${u.port}` : '';
    const db = u.pathname.replace(/^\//, '');
    const auth = u.username ? `${u.username}${u.password ? ':••••' : ''}@` : '';
    return `${u.protocol}//${auth}${u.hostname}${port}${db ? `/${db}` : ''}`;
  } catch {
    return url.replace(/(\/\/[^:/@]+:)[^@]+@/, '$1••••@');
  }
}

export function printStartupBanner(): void {
  const { PORT, APP_NAME, APP_VERSION, NODE_ENV, LOG_LEVEL, ENABLE_DOCS, ALLOWED_ORIGINS, DATABASE_URL } = env;
  const { STORAGE_DRIVER, S3_BUCKET, EMAIL_PROVIDER } = env;
  const lan = lanAddress();

  // Vite-style access URLs for this API server.
  const urls: Array<[string, string]> = [
    ['Local', `http://localhost:${PORT}/`],
    ['Network', lan ? `http://${lan}:${PORT}/` : dim('(no external network interface)')],
  ];
  if (ENABLE_DOCS) urls.push(['Docs', `http://localhost:${PORT}/docs`]);

  // Scalar config values (secrets masked); ALLOWED_ORIGINS is rendered as a list below.
  const LABEL_W = 15;
  const rows: Array<[string, string]> = [
    ['NODE_ENV', envBadge(NODE_ENV)],
    ['PORT', String(PORT)],
    ['LOG_LEVEL', LOG_LEVEL],
    ['ENABLE_DOCS', String(ENABLE_DOCS)],
    ['DATABASE_URL', maskDbUrl(DATABASE_URL)],
    ['STORAGE_DRIVER', STORAGE_DRIVER === 's3' ? cyan(`s3 → ${S3_BUCKET ?? '(no bucket)'}`) : 'local'],
    ['EMAIL_PROVIDER', EMAIL_PROVIDER === 'console' ? `console ${dim('(logged, not sent)')}` : EMAIL_PROVIDER],
  ];

  const out: string[] = [''];
  const readyMs = Math.round(process.uptime() * 1000);
  out.push(`  ${green('●')} ${bold(APP_NAME)} ${dim(`v${APP_VERSION}`)}  ${dim(`ready in ${readyMs} ms`)}`);
  out.push('');
  for (const [label, url] of urls) {
    out.push(`  ${green('➜')}  ${dim(label.padEnd(8))} ${cyan(url)}`);
  }
  out.push('');
  for (const [label, value] of rows) {
    out.push(`  ${dim(label.padEnd(LABEL_W))}  ${value}`);
  }

  // ALLOWED_ORIGINS: one origin per line, aligned under the value column and cyan
  // like the access URLs — keeps a long list tidy instead of wrapping to column 0.
  const originIndent = ' '.repeat(2 + LABEL_W + 2);
  const [firstOrigin, ...moreOrigins] = ALLOWED_ORIGINS;
  out.push(`  ${dim('ALLOWED_ORIGINS'.padEnd(LABEL_W))}  ${firstOrigin ? cyan(firstOrigin) : dim('(none)')}`);
  for (const origin of moreOrigins) {
    out.push(`${originIndent}${cyan(origin)}`);
  }
  out.push('');

  process.stdout.write(`${out.join('\n')}\n`);
}
