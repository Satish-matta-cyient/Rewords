/** Minimal, dependency-free CSV writer with injection protection. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return (columns ?? []).join(',');
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escapeCell).join(',');
  const body = rows.map((row) => cols.map((c) => escapeCell(row[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function parseCodeList(input: string): string[] {
  return input
    .split(/[\r\n,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}
