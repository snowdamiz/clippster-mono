import type { AuthUser, SubscriptionStatus } from '@clippster/shared-types';
import { TIER_HIERARCHY } from '@clippster/shared-types';

export type GateActionType =
  | 'download'
  | 'project'
  | 'live'
  | 'editor'
  | 'ai'
  | 'expired'
  | 'general';

export function bypassesPersonalSubscription(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.is_admin) return true;
  if (user.created_by_organization_id) return true;
  if (user.owned_organization_id) return true;
  if (user.account_type === 'organization') return true;
  return false;
}

export function isSubscriptionPeriodOpen(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  if (status.end_date) {
    const end = Date.parse(status.end_date);
    if (!Number.isNaN(end)) return end > Date.now();
  }
  return (status.days_remaining ?? 0) > 0;
}

export function hasValidSubscription(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  if (status.status === 'active') {
    if (status.end_date) return isSubscriptionPeriodOpen(status);
    return true;
  }
  if (status.status === 'cancelled') {
    return isSubscriptionPeriodOpen(status);
  }
  return false;
}

export function needsSubscription(status: SubscriptionStatus | null | undefined): boolean {
  return status?.needs_subscription ?? true;
}

export function requiresPlanSelectionGate(
  user: AuthUser | null | undefined,
  status: SubscriptionStatus | null | undefined,
  hasSelectedPlan: boolean,
): boolean {
  if (!user) return false;
  if (bypassesPersonalSubscription(user)) return false;
  if (hasValidSubscription(status)) return false;
  return !hasSelectedPlan;
}

export function tierMeetsRequirement(
  userTier: string | null | undefined,
  requiredTier: string,
): boolean {
  const userLevel = TIER_HIERARCHY[userTier ?? 'free'] ?? 0;
  const requiredLevel = TIER_HIERARCHY[requiredTier] ?? 0;
  return userLevel >= requiredLevel;
}

export function formatCreditsAvailable(total: number | 'unlimited' | null | undefined): string {
  if (total === 'unlimited') return 'Unlimited';
  if (total == null) return '—';
  const minutes = Math.floor(total * 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes} min`;
}

export function displayTierLabel(
  status: SubscriptionStatus | null | undefined,
  isAdmin: boolean,
): string {
  if (isAdmin) return 'Admin';
  if (!status?.tier_name && status?.status === 'none') return 'Free';
  if (status?.tier_name) return status.tier_name;
  if (hasValidSubscription(status)) return 'Subscribed';
  return 'Free';
}
