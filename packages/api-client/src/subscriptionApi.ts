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

interface CryptoQuoteResponse {
  success: boolean;
  quote?: {
    amount: string | number;
    currency?: string;
    address?: string;
    expires_at?: string;
    [key: string]: unknown;
  };
  error?: string;
}

interface CryptoConfirmResponse {
  success: boolean;
  message?: string;
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

    getCryptoQuote(tier: string) {
      return client.post<CryptoQuoteResponse>('/subscription/crypto-quote', { tier });
    },

    confirmCryptoPayment(payload: Record<string, unknown>) {
      return client.post<CryptoConfirmResponse>('/subscription/crypto-confirm', payload);
    },
  };
}

export type SubscriptionApi = ReturnType<typeof createSubscriptionApi>;
