import type {
  CreditBalanceResponse,
  SubscriptionStatus,
  SubscriptionTierInfo,
} from '@clippster/shared-types';
import type { ApiClient } from './createApiClient';

export type { CreditBalanceResponse, SubscriptionStatus, SubscriptionTierInfo };

export function createCreditsApi(client: ApiClient) {
  return {
    getBalance() {
      return client.get<CreditBalanceResponse>('/credits/balance');
    },
  };
}

export type CreditsApi = ReturnType<typeof createCreditsApi>;
