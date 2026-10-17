function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function flattenRecord(record: object, prefix = ''): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const column = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(fields, flattenRecord(value, column));
    } else {
      fields[column] = value;
    }
  }
  return fields;
}

/** Include all returned fields, with nested details in separate columns. */
export function buildRecordsCsv(records: readonly object[]): string {
  const rows = records.map((record) => flattenRecord(record));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const serialize = (value: unknown): string => {
    if (value == null) return '';
    return escapeCsvField(typeof value === 'object' ? JSON.stringify(value) : String(value));
  };
  const lines = [columns.map(escapeCsvField).join(','), ...rows.map((row) =>
    columns.map((column) => serialize(row[column])).join(','),
  )];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadRecordsCsv(records: readonly object[], filename: string) {
  const blob = new Blob([buildRecordsCsv(records)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
