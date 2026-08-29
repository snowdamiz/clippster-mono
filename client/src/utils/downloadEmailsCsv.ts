function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildEmailsCsv(emails: Array<string | null | undefined>): string {
  const rows = emails
    .map((email) => (email ?? '').trim())
    .filter(Boolean)
    .map(escapeCsvField)

  return `\uFEFF${['email', ...rows].join('\r\n')}\r\n`
}

function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const candidate = window as unknown as Record<string, unknown>
  return '__TAURI_INTERNALS__' in candidate || '__TAURI__' in candidate
}

function downloadEmailsCsvInBrowser(csv: string, filename: string) {
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
 * Save a list of emails as a CSV file.
 * Uses Tauri's save dialog in the desktop app (blob downloads are a no-op in WebView).
 */
export async function downloadEmailsCsv(
  emails: Array<string | null | undefined>,
  filename: string,
): Promise<void> {
  const csv = buildEmailsCsv(emails)

  if (isDesktopRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    const path = await save({
      title: 'Export Emails CSV',
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })

    if (!path) return

    await writeFile(path, new TextEncoder().encode(csv))
    return
  }

  downloadEmailsCsvInBrowser(csv, filename)
}
