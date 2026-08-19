function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function downloadEmailsCsv(emails: Array<string | null | undefined>, filename: string) {
  const rows = emails
    .map((email) => (email ?? '').trim())
    .filter(Boolean)
    .map(escapeCsvField)

  const csv = `\uFEFF${['email', ...rows].join('\r\n')}\r\n`
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
