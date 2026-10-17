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

function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const candidate = window as unknown as Record<string, unknown>
  return '__TAURI_INTERNALS__' in candidate || '__TAURI__' in candidate
}

function downloadCsvInBrowser(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Save complete records as a CSV file.
 * Uses Tauri's save dialog in the desktop app (blob downloads are a no-op in WebView).
 */
export async function downloadRecordsCsv(
  records: readonly object[],
  filename: string,
): Promise<void> {
  const csv = buildRecordsCsv(records)

  if (isDesktopRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    const path = await save({
      title: 'Export CSV',
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })

    if (!path) return

    await writeFile(path, new TextEncoder().encode(csv))
    return
  }

  downloadCsvInBrowser(csv, filename)
}
