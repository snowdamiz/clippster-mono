export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'N/A'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'N/A'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatWalletAddress(value: string | null | undefined): string {
  if (!value) return 'N/A'
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function formatDurationSeconds(value: string | number | null | undefined): string {
  const secs = Number(value || 0)
  if (!Number.isFinite(secs) || secs <= 0) return '0s'
  if (secs < 60) return `${Math.round(secs)}s`
  const mins = Math.floor(secs / 60)
  const rem = Math.round(secs % 60)
  return `${mins}m ${rem}s`
}

export function formatHoursToMinutes(value: number | 'unlimited' | null | undefined): string {
  if (value === 'unlimited') return 'Unlimited'
  const hours = Number(value || 0)
  return `${Math.round(hours * 60)} min`
}

export function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}
