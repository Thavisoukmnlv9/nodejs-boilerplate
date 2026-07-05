/**
 * Minimal RFC-4180 CSV serialiser for list exports. No dependency — every list
 * endpoint feeds it a column spec + rows and streams the result as `text/csv`.
 * Values are stringified, and any cell containing a quote, comma or newline is
 * wrapped in quotes with inner quotes doubled.
 */
export interface CsvColumn<T> {
  key: string;
  header: string;
  value: (row: T) => unknown;
}

function escapeCell(input: unknown): string {
  if (input === null || input === undefined) return '';
  const s = Array.isArray(input) ? input.join('; ') : String(input);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(',')).join('\r\n');
  return body ? `${header}\r\n${body}\r\n` : `${header}\r\n`;
}

/** Cap on rows returned by an export endpoint (guards against unbounded scans). */
export const EXPORT_ROW_CAP = 10_000;
