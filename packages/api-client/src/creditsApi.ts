import type { ApiClient } from './createApiClient';

export interface CreditsBalanceResponse {
  success: boolean;
  balance?: number;
  credits?: number;
  error?: string;
}

export function createCreditsApi(client: ApiClient) {
  return {
    getBalance() {
      return client.get<CreditsBalanceResponse>('/credits/balance');
    },
  };
}

export type CreditsApi = ReturnType<typeof createCreditsApi>;
