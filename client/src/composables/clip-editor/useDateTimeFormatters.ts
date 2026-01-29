/**
 * useDateTimeFormatters - Date and time formatting utilities
 *
 * Extracted from ExistingProjectDialog.vue to centralize date/timestamp formatting.
 * Complements useEditorFormatters which handles duration/time formatting.
 */

/**
 * Format a Unix timestamp (in seconds) as a human-readable date
 * @param timestamp - Unix timestamp in seconds
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string
 */
export function formatDate(
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string {
  // Timestamp is in seconds, convert to milliseconds
  const date = new Date(timestamp * 1000);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return date.toLocaleDateString(undefined, options || defaultOptions);
}

/**
 * Format a Unix timestamp as a short date (no time)
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatShortDate(timestamp: number): string {
  return formatDate(timestamp, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a Unix timestamp as time only
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTimeFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a Unix timestamp as a relative time (e.g., "2 hours ago")
 * @param timestamp - Unix timestamp in seconds
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000; // Convert to seconds
  const diff = now - timestamp;

  if (diff < 60) {
    return 'just now';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    return formatShortDate(timestamp);
  }
}

/**
 * Format duration with hours support (for longer durations)
 * Different from useEditorFormatters.formatDuration which is for shorter clips
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "1:30:45" or "5:30")
 */
export function formatLongDuration(seconds: number): string {
  if (!seconds) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface DateTimeFormattersReturn {
  formatDate: typeof formatDate;
  formatShortDate: typeof formatShortDate;
  formatTimeFromTimestamp: typeof formatTimeFromTimestamp;
  formatRelativeTime: typeof formatRelativeTime;
  formatLongDuration: typeof formatLongDuration;
}

/**
 * Composable that returns all date/time formatter functions
 */
export function useDateTimeFormatters(): DateTimeFormattersReturn {
  return {
    formatDate,
    formatShortDate,
    formatTimeFromTimestamp,
    formatRelativeTime,
    formatLongDuration,
  };
}
