/** Match client `timeUtils` for public clipper profile parity with Tauri app. */

export function formatLastActive(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) {
    return 'Last seen a while ago'
  }

  const now = new Date()
  const lastActive = new Date(lastActiveAt)
  const diffMs = now.getTime() - lastActive.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffMinutes < 5) {
    return 'Last seen recently'
  }
  if (diffMinutes < 60) {
    return `Last seen ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diffHours < 24) {
    return `Last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  }
  if (diffDays < 7) {
    return `Last seen ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  }
  if (diffWeeks < 4) {
    return `Last seen ${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`
  }
  if (diffMonths < 12) {
    return `Last seen ${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
  }
  return 'Last seen a while ago'
}

export function isOnline(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) {
    return false
  }
  const now = new Date()
  const lastActive = new Date(lastActiveAt)
  const diffMs = now.getTime() - lastActive.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  return diffMinutes < 5
}
