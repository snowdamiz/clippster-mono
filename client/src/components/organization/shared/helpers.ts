/**
 * Small display helpers shared by the organization dialogs and lists
 * (shared clips/audio, member pickers, scheduled posts).
 */
import type { BadgeVariants } from '@/components/ui/badge';
import { getExpirationBadgeColor } from '@/services/sharedClipsApi';

/** `m:ss` clock for media durations; `--:--` when unknown. */
export function formatClock(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Human file size (B / KB / MB); `Unknown` when missing. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Badge tone for an organization role. */
export function roleBadgeVariant(role: string | null | undefined): BadgeVariants['variant'] {
  if (role === 'owner') return 'brand';
  if (role === 'admin') return 'outline';
  return 'neutral';
}

/** Badge tone for the "expires in N days" pill on shared clips/audio. */
export function expirationBadgeVariant(daysRemaining: number): BadgeVariants['variant'] {
  const color = getExpirationBadgeColor(daysRemaining);
  return color === 'red' ? 'danger' : color === 'yellow' ? 'warning' : 'neutral';
}
