/**
 * Minimal RFC 4180 CSV writer.
 *
 * Hand-rolled rather than pulled from a dependency because the requirement is
 * small and the one thing that matters — escaping — is easy to get wrong in a
 * `join(",")`.
 */

/**
 * Quotes a field when it contains a delimiter, quote or newline, doubling any
 * embedded quotes.
 *
 * Also neutralises the leading characters that spreadsheet software treats as
 * the start of a formula. Without this, a link titled `=HYPERLINK(...)` would
 * execute when the export is opened in Excel — CSV injection.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  // CRLF per RFC 4180, and a BOM so Excel detects UTF-8 rather than mangling
  // accented characters.
  return `﻿${lines.join("\r\n")}\r\n`;
}
