export type SubscriptionStatusValue = 'none' | 'active' | 'cancelled' | 'expired';

export interface SubscriptionStatus {
  status: SubscriptionStatusValue;
  tier: string | null;
  tier_name: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_method: 'stripe' | 'crypto' | null;
  needs_subscription: boolean;
  days_remaining: number;
  pending_subscription_tier?: string | null;
  pending_subscription_tier_name?: string | null;
  organization_id?: number | null;
}

export interface OrganizationCreditAllocation {
  organization_id: number;
  organization_name: string;
  role: string;
  hours_allocated: number;
  hours_used: number;
  hours_remaining: number;
}

export interface CreditBalancePayload {
  hours_remaining: number | 'unlimited';
  hours_used: number;
}

export interface CreditBalanceResponse {
  success: boolean;
  balance?: CreditBalancePayload;
  subscription?: SubscriptionStatus;
  organization_allocations?: OrganizationCreditAllocation[];
  total_available?: number | 'unlimited';
  error?: string;
}

export interface SubscriptionTierInfo {
  id: string;
  name: string;
  monthly_credits: number;
  price_usd: number;
}

/** Personal subscription tiers (matches server @subscription_tiers + free). */
export const SUBSCRIPTION_TIER_IDS = ['starter', 'creator', 'pro'] as const;
export type PaidSubscriptionTierId = typeof SUBSCRIPTION_TIER_IDS[number];

export const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  basic: 0.5,
  starter: 1,
  creator: 2,
  pro: 3,
};
