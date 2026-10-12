/**
 * Status → Badge variant mapping shared by admin tables, so the same status
 * word always gets the same color across pages.
 *
 *   <Badge :variant="statusVariant(code.status)">{{ formatStatus(code.status) }}</Badge>
 */
import type { BadgeVariants } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeVariants['variant']>;

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Good / live
  active: 'success',
  approved: 'success',
  paid: 'success',
  completed: 'success',
  complete: 'success',
  succeeded: 'success',
  success: 'success',
  published: 'success',
  resolved: 'success',
  verified: 'success',
  enabled: 'success',
  redeemed: 'success',
  // In progress / attention
  pending: 'warning',
  processing: 'warning',
  in_review: 'warning',
  review: 'warning',
  past_due: 'warning',
  unpaid: 'warning',
  open: 'warning',
  in_progress: 'brand',
  scheduled: 'brand',
  trialing: 'brand',
  trial: 'brand',
  // Bad / stopped
  rejected: 'danger',
  failed: 'danger',
  error: 'danger',
  banned: 'danger',
  suspended: 'danger',
  revoked: 'danger',
  canceled: 'danger',
  cancelled: 'danger',
  // Neutral / dormant
  inactive: 'neutral',
  expired: 'neutral',
  disabled: 'neutral',
  paused: 'neutral',
  archived: 'neutral',
  draft: 'neutral',
  ended: 'neutral',
  closed: 'neutral',
  used: 'neutral',
  none: 'neutral',
};

export function statusVariant(status?: string | null): BadgeVariant {
  if (!status) return 'neutral';
  return STATUS_VARIANTS[status.toLowerCase()] ?? 'neutral';
}

/** `past_due` → `Past due`; empty → `None`. */
export function formatStatus(status?: string | null): string {
  if (!status) return 'None';
  const text = status.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
