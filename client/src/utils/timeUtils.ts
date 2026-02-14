/**
 * Format a timestamp as a relative "last active" string
 * @param lastActiveAt - ISO timestamp string or null
 * @returns Formatted string like "Last seen recently" or "Last seen 3 days ago"
 */
export function formatLastActive(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) {
    return 'Last seen a while ago';
  }

  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  // Less than 5 minutes
  if (diffMinutes < 5) {
    return 'Last seen recently';
  }

  // Less than 1 hour
  if (diffMinutes < 60) {
    return `Last seen ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `Last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `Last seen ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  // Less than 4 weeks
  if (diffWeeks < 4) {
    return `Last seen ${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  // Less than 12 months
  if (diffMonths < 12) {
    return `Last seen ${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  }

  // Over a year
  return 'Last seen a while ago';
}

/**
 * Check if a user is currently online (active within last 5 minutes)
 * @param lastActiveAt - ISO timestamp string or null
 * @returns true if user is considered online
 */
export function isOnline(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) {
    return false;
  }

  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  return diffMinutes < 5;
}

/**
 * Get a color class based on how recently the user was active
 * @param lastActiveAt - ISO timestamp string or null
 * @returns CSS class name for styling
 */
export function getLastActiveColorClass(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) {
    return 'text-gray-500';
  }

  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  // Active within last hour - green
  if (diffHours < 1) {
    return 'text-green-500';
  }

  // Active within last 24 hours - cyan
  if (diffHours < 24) {
    return 'text-cyan-500';
  }

  // Active within last week - yellow
  if (diffHours < 168) {
    return 'text-yellow-500';
  }

  // Older - gray
  return 'text-gray-500';
}
