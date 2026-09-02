import type { SubscriptionTierInfo } from '@clippster/shared-types';

export type BillingInterval = 'monthly' | 'yearly';

export type PlanFeature = {
  label: string;
  included: boolean;
  note?: boolean;
};

export const FREE_PLAN: SubscriptionTierInfo = {
  id: 'free',
  name: 'Free',
  monthly_credits: 60,
  price_usd: 0,
};

export const FALLBACK_PAID_TIERS: SubscriptionTierInfo[] = [
  { id: 'basic', name: 'Basic', monthly_credits: 0, price_usd: 12.99 },
  { id: 'starter', name: 'Starter', monthly_credits: 600, price_usd: 24.99 },
  { id: 'creator', name: 'Creator', monthly_credits: 1800, price_usd: 49.99 },
  { id: 'pro', name: 'Pro', monthly_credits: 9000, price_usd: 199.99 },
];

const TIER_ORDER = ['free', 'basic', 'starter', 'creator', 'pro'];

export function mergeDisplayTiers(apiTiers: SubscriptionTierInfo[]): SubscriptionTierInfo[] {
  const byId = new Map<string, SubscriptionTierInfo>();
  for (const tier of FALLBACK_PAID_TIERS) byId.set(tier.id, tier);
  for (const tier of apiTiers) byId.set(tier.id, tier);

  return [FREE_PLAN, ...TIER_ORDER.slice(1).flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))];
}

export function yearlyPrice(priceUsd: number): number {
  return Number((priceUsd * 11).toFixed(2));
}

export function effectiveMonthlyPrice(priceUsd: number): number {
  return Number((yearlyPrice(priceUsd) / 12).toFixed(2));
}

export function displayPrice(tier: SubscriptionTierInfo, interval: BillingInterval): string {
  if (tier.price_usd === 0) return '0';
  const amount = interval === 'yearly' ? yearlyPrice(tier.price_usd) : tier.price_usd;
  return amount.toFixed(2);
}

export function creditsLabel(tier: SubscriptionTierInfo, interval: BillingInterval): string {
  if (tier.id === 'free') return '60 one-time credits';
  if (interval === 'yearly') {
    return `${(tier.monthly_credits * 12).toLocaleString()} credits upfront`;
  }
  return `${tier.monthly_credits.toLocaleString()} credits/month`;
}

export function featuresForTier(tierId: string): PlanFeature[] {
  if (tierId === 'free') {
    return [
      { label: 'Mobile App', included: true },
      { label: '5 clip builds/day', included: true },
      { label: '1 editor export/day', included: true },
      { label: '2 VOD downloads/day', included: true },
      { label: 'Admin watermark applied', included: true },
      { label: 'No social posting', included: false },
      { label: 'No AI Video Creator', included: false },
      { label: 'No campaign participation', included: false },
    ];
  }

  if (tierId === 'basic') {
    return [
      { label: 'Mobile App', included: true },
      { label: 'Unlimited clip builds', included: true },
      { label: 'Social posting & scheduling', included: true },
      { label: 'Campaign participation', included: true },
      { label: 'Custom watermark & intro/outro', included: true },
      { label: 'No AI clip detection', included: false },
      { label: 'No AI Video Creator', included: false },
      { label: 'No organization membership', included: false },
      { label: 'Large credit pack only (1,800 @ $39.99)', included: true, note: true },
    ];
  }

  const features: PlanFeature[] = [
    { label: 'Mobile App', included: true },
    { label: 'Unlimited clip builds', included: true },
    { label: 'AI clip detection', included: true },
    { label: 'Custom watermark & intro/outro', included: true },
    { label: 'Social posting & scheduling', included: true },
    { label: 'Organization membership', included: true },
    { label: 'Credits roll over', included: true },
  ];

  if (tierId === 'creator' || tierId === 'pro') {
    features.splice(5, 0, { label: 'AI Video Creator', included: true });
  } else {
    features.push({ label: 'No AI Video Creator', included: false });
  }

  return features;
}

export function shouldResetPlanSelectionOnStatusChange(
  previous: string | null | undefined,
  next: string | null | undefined,
): boolean {
  return next === 'expired' && (previous === 'active' || previous === 'cancelled');
}

export function shouldResetPlanSelectionAfterRefresh(
  previousWasValid: boolean,
  nextIsValid: boolean,
): boolean {
  return previousWasValid && !nextIsValid;
}
