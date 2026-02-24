/**
 * Centralized date/time formatting utilities for landing app.
 * All functions convert UTC timestamps to the user's local timezone.
 * Uses 12-hour format by default (can be enhanced with user preferences later).
 */

/**
 * Format a date as "Feb 23, 2026"
 */
export function formatDate(input: string | number | Date | null | undefined): string {
  if (!input) return '';
  const date = toDate(input);
  if (!date || isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format time as "3:45 PM"
 */
export function formatTime(input: string | number | Date | null | undefined): string {
  if (!input) return '';
  const date = toDate(input);
  if (!date || isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format as "Feb 23, 2026 at 3:45 PM"
 */
export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (!input) return '';
  const date = toDate(input);
  if (!date || isNaN(date.getTime())) return '';

  return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Format relative time: "Just now", "5m ago", "2h ago", "Yesterday", "Feb 23, 2026"
 */
export function formatRelativeTime(input: string | number | Date | null | undefined): string {
  if (!input) return '';
  const date = toDate(input);
  if (!date || isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(date);
}

/**
 * Smart message timestamp:
 * - Today: "3:45 PM"
 * - Yesterday: "Yesterday"
 * - This week: "Mon", "Tue", etc.
 * - Older: "Feb 23, 2026"
 */
export function formatMessageTime(input: string | number | Date | null | undefined): string {
  if (!input) return '';
  const date = toDate(input);
  if (!date || isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 6 * 86400000);

  if (date >= today) {
    return formatTime(date);
  }
  if (date >= yesterday) {
    return 'Yesterday';
  }
  if (date >= weekAgo) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  return formatDate(date);
}

/**
 * Format for conversation list: "3:45 PM" today, "Yesterday", "Feb 23" older
 */
export function formatConversationTime(input: string | number | Date | null | undefined): string {
  if (!input) return '';
  const date = toDate(input);
  if (!date || isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  if (date >= today) {
    return formatTime(date);
  }
  if (date >= yesterday) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a Unix timestamp (seconds) as "Feb 23, 2026"
 */
export function formatUnixDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  return formatDate(new Date(timestamp * 1000));
}

/**
 * Format a Unix timestamp (seconds) as "Feb 23, 2026 at 3:45 PM"
 */
export function formatUnixDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  return formatDateTime(new Date(timestamp * 1000));
}

/**
 * Convert various input types to a Date object.
 */
function toDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') {
    // If it looks like seconds (before year 2100 in ms), convert to ms
    if (input < 4102444800) return new Date(input * 1000);
    return new Date(input);
  }
  if (typeof input === 'string') {
    // Elixir/Phoenix sends naive_datetime as ISO without timezone suffix.
    // Append Z so JS parses them as UTC instead of local time.
    let str = input;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) && !/[Z+-]\d{0,4}$/.test(str)) {
      str += 'Z';
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(NaN);
}
