import type { SubscriptionStatus, SubscriptionTierInfo } from '@clippster/shared-types';
import type { ApiClient } from './createApiClient';

interface SubscriptionStatusResponse {
  success: boolean;
  subscription?: SubscriptionStatus;
  error?: string;
}

interface SubscriptionTiersResponse {
  success: boolean;
  tiers?: SubscriptionTierInfo[];
  error?: string;
}

interface CheckoutResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export function createSubscriptionApi(client: ApiClient) {
  return {
    getStatus() {
      return client.get<SubscriptionStatusResponse>('/subscription/status');
    },

    getTiers() {
      return client.get<SubscriptionTiersResponse>('/subscription/tiers');
    },

    createCheckout(
      tier: string,
      options?: { billing_interval?: 'monthly' | 'yearly'; return_context?: string },
    ) {
      return client.post<CheckoutResponse>('/subscription/checkout', {
        tier,
        billing_interval: options?.billing_interval ?? 'monthly',
        return_context: options?.return_context ?? 'mobile',
      });
    },
  };
}

export type SubscriptionApi = ReturnType<typeof createSubscriptionApi>;
