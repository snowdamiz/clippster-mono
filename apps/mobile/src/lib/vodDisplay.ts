/**
 * VOD timestamp + duration formatting — mirrors desktop StreamVods.vue helpers.
 */

export function toStreamDate(input: string | number | Date | null | undefined): Date | null {
  if (input == null || input === '') return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const ms = input > 1e12 ? input : input * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const trimmed = String(input).trim();
  if (!trimmed) return null;

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6)) - 1;
    const day = Number(trimmed.slice(6, 8));
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = trimmed.includes(' ') && !trimmed.includes('T')
    ? trimmed.replace(' ', 'T')
    : trimmed;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatStreamedDate(input: string | number | Date | null | undefined): string {
  const date = toStreamDate(input);
  if (!date) return 'No timestamp';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatStreamedRelative(input: string | number | Date | null | undefined): string {
  const date = toStreamDate(input);
  if (!date) return 'Streamed recently';

  const secondsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secondsAgo < 60) return 'Streamed just now';
  if (secondsAgo < 3600) return `Streamed ${Math.floor(secondsAgo / 60)} minutes ago`;
  if (secondsAgo < 86400) return `Streamed ${Math.floor(secondsAgo / 3600)} hours ago`;
  if (secondsAgo < 604800) return `Streamed ${Math.floor(secondsAgo / 86400)} days ago`;
  return `Streamed ${Math.floor(secondsAgo / 604800)} weeks ago`;
}

export function formatVodDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function formatViewCount(views: number | null | undefined): string | null {
  if (views == null || views < 0) return null;
  if (views < 1000) return `${views} views`;
  if (views < 1_000_000) return `${(views / 1000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
}
