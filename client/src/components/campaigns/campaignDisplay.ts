/**
 * Display helpers shared by the campaign marketplace, campaign detail page and
 * campaign dialogs (money, budget usage, deadlines, status tone). Pure
 * formatting only — no API or business logic lives here.
 */
import type { BadgeVariants } from '@/components/ui/badge';
import type { Campaign } from '@/services/campaignApi';

type Numeric = string | number | null | undefined;

export function toNumber(value: Numeric): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `2.5` → `"2.50"` */
export function formatCpm(cpm: Numeric): string {
  return toNumber(cpm).toFixed(2);
}

const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Whole-dollar amounts, compact: `5000` → `"5K"`, `1840` → `"1.8K"`, `450` → `"450"` */
export function formatBudget(budget: Numeric): string {
  return compactFormatter.format(Math.round(toNumber(budget)));
}

/** `18400000` → `"18.4M"`, `9200` → `"9.2K"`, `840000` → `"840K"` */
export function formatCompact(value: Numeric): string {
  return compactFormatter.format(toNumber(value));
}

/** Share of the budget already spent, clamped to 0–100. */
export function budgetPercent(campaign: Pick<Campaign, 'budget' | 'spent_budget'>): number {
  const budget = toNumber(campaign.budget);
  if (budget === 0) return 0;
  return Math.min((toNumber(campaign.spent_budget) / budget) * 100, 100);
}

export function remainingBudget(campaign: Pick<Campaign, 'budget' | 'spent_budget'>): number {
  return Math.max(toNumber(campaign.budget) - toNumber(campaign.spent_budget), 0);
}

/** Whole days until `ends_at` (rounded up), or null when open-ended. */
export function daysRemaining(endsAt: string | null | undefined): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

/** Short deadline label: "12d left", "Ends today", "Ended". */
export function deadlineLabel(endsAt: string | null | undefined): string | null {
  const days = daysRemaining(endsAt);
  if (days === null) return null;
  if (days > 0) return `${days}d left`;
  if (days === 0) return 'Ends today';
  return 'Ended';
}

/** The headline payout: CPM rate or the flat per-clip amount. */
export function payout(campaign: Pick<Campaign, 'payment_model' | 'cpm' | 'per_clip_amount'>): {
  value: string;
  unit: string;
} {
  if (campaign.payment_model === 'per_clip') {
    return { value: `$${formatCpm(campaign.per_clip_amount)}`, unit: 'per clip' };
  }
  return { value: `$${formatCpm(campaign.cpm)}`, unit: 'per 1K views' };
}

const STATUS_VARIANT: Record<string, BadgeVariants['variant']> = {
  active: 'success',
  approved: 'success',
  verified: 'success',
  completed: 'neutral',
  paid: 'success',
  paused: 'warning',
  pending: 'warning',
  draft: 'outline',
  rejected: 'danger',
  removed: 'danger',
  failed: 'danger',
};

/** Badge tone for campaign / participant / submission / payment statuses. */
export function statusVariant(status: string | null | undefined): BadgeVariants['variant'] {
  return STATUS_VARIANT[(status || '').toLowerCase()] ?? 'neutral';
}

/** `"application_required"` → `"Application required"` */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const text = value.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
