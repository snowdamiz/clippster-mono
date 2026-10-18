/** Display-only catalog. Prices and entitlements remain owned by the billing API. */
export const PERSONAL_PLAN_ORDER = ['starter', 'creator', 'pro'] as const;

export const PLAN_PRESENTATION: Record<string, { description: string; features: string[] }> = {
  basic: {
    description: 'Editing & publishing',
    features: ['Unlimited clip builds', 'Social posting & scheduling', 'Custom watermark & intro/outro', 'No AI clip detection or AI Video Creator'],
  },
  starter: {
    description: 'Start your AI clipping workflow',
    features: ['AI clip detection', 'Unlimited clip builds', 'Social posting & scheduling', 'Custom watermark & intro/outro', 'Paid minutes roll over'],
  },
  creator: {
    description: 'Create and publish consistently',
    features: ['Everything in Starter', 'AI Video Creator access', '3× Starter’s processing minutes', 'Paid minutes roll over'],
  },
  pro: {
    description: 'For high-volume individual creators',
    features: ['Everything in Creator', '5× Creator’s processing minutes', 'Paid minutes roll over', 'Individual subscription; no team seats included'],
  },
};

export function personalPlanQuote(price: number, minutes: number, yearly: boolean) {
  const totalCents = Math.round(price * 100) * (yearly ? 11 : 1);
  return {
    monthlyPrice: (totalCents / (yearly ? 12 : 1) / 100).toFixed(2),
    billedPrice: (totalCents / 100).toFixed(2),
    minutes: minutes * (yearly ? 12 : 1),
    allowanceLabel: yearly ? 'minutes upfront for the year' : 'minutes/month',
    billingLabel: yearly ? 'billed yearly' : 'billed monthly',
  };
}

export const BUSINESS_PLAN_NAMES: Record<string, string> = {
  solo: 'Business Solo',
  enterprise_base: 'Business',
  enterprise_ai: 'Business AI',
  enterprise_unlimited: 'Business Scale',
};

export function businessPlanName(name: string): string {
  return BUSINESS_PLAN_NAMES[name] || ({
    Solo: 'Business Solo',
    'Enterprise Base': 'Business',
    'Enterprise AI': 'Business AI',
    'Enterprise Unlimited': 'Business Scale',
  } as Record<string, string>)[name] || name;
}
