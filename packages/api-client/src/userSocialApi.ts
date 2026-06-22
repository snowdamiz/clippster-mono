import type { ApiClient } from './createApiClient';
import type { SocialPlatform } from './schedulingApi';

export interface UserSocialAccount {
  id: number;
  platform: SocialPlatform | string;
  platform_user_id: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  is_active: boolean;
  token_expires_at: string | null;
  connected_at: string;
  inserted_at: string;
  updated_at: string;
}

export interface ListSocialAccountsResponse {
  success: boolean;
  social_accounts?: UserSocialAccount[];
  accounts?: UserSocialAccount[];
  error?: string;
}

export interface AccountResponse {
  success: boolean;
  account?: UserSocialAccount;
  error?: string;
}

export interface ConnectUrlResponse {
  success: boolean;
  connection_id?: string;
  auth_url?: string;
  external_id?: string;
  platform?: string;
  error?: string;
}

export interface ConnectStatusResponse {
  success: boolean;
  connection_id?: string;
  status?: 'pending' | 'callback_received' | 'synced' | 'failed' | 'expired';
  session_success?: boolean | null;
  account_ids?: string[];
  external_id?: string;
  platform?: string;
  error?: string;
}

export interface CompleteConnectResponse {
  success: boolean;
  social_account?: UserSocialAccount;
  social_accounts?: UserSocialAccount[];
  error?: string;
}

export const POST_FOR_ME_STATUS_POLL_INTERVAL_MS = 1500;
export const POST_FOR_ME_STATUS_TIMEOUT_MS = 180_000;

export function isTokenExpiringSoon(account: UserSocialAccount): boolean {
  if (!account.token_expires_at) return false;
  const expiresAt = new Date(account.token_expires_at);
  const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry < 7;
}

export function isTokenExpired(tokenExpiresAt?: string | null): boolean {
  if (!tokenExpiresAt) return false;
  const expiresAt = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt <= Date.now();
}

export function getSocialPlatformLabel(platform: string): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'x':
    case 'twitter':
      return 'X (Twitter)';
    case 'tiktok':
      return 'TikTok';
    case 'youtube':
      return 'YouTube';
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
}

export function createUserSocialApi(client: ApiClient) {
  return {
    getConnectUrl(platform: SocialPlatform) {
      return client.post<ConnectUrlResponse>('/user/social/connect-url', { platform });
    },

    getConnectStatus(connectionId: string) {
      return client.get<ConnectStatusResponse>(
        `/user/social/connect-status?connection_id=${encodeURIComponent(connectionId)}`,
      );
    },

    completeConnect(connectionId: string, platform: SocialPlatform) {
      return client.post<CompleteConnectResponse>('/user/social/complete-connect', {
        connection_id: connectionId,
        platform,
      });
    },

    listAccounts(platform?: SocialPlatform) {
      const query = platform ? `?platform=${encodeURIComponent(platform)}` : '';
      return client.get<ListSocialAccountsResponse>(`/user/social-accounts${query}`);
    },

    disconnectAccount(accountId: number) {
      return client.delete<AccountResponse>(`/user/social-accounts/${accountId}`);
    },

    getOrgConnectUrl(organizationId: number, platform: SocialPlatform) {
      return client.post<ConnectUrlResponse>('/social/connect-url', {
        organization_id: organizationId,
        platform,
      });
    },

    getOrgConnectStatus(organizationId: number, connectionId: string) {
      return client.get<ConnectStatusResponse>(
        `/social/connect-status?organization_id=${organizationId}&connection_id=${encodeURIComponent(connectionId)}`,
      );
    },

    completeOrgConnect(organizationId: number, connectionId: string, platform: SocialPlatform) {
      return client.post<CompleteConnectResponse>('/social/complete-connect', {
        organization_id: organizationId,
        connection_id: connectionId,
        platform,
      });
    },

    listOrgAccounts(organizationId: number, platform?: SocialPlatform) {
      const query = platform ? `?platform=${encodeURIComponent(platform)}` : '';
      return client.get<ListSocialAccountsResponse>(
        `/organizations/${organizationId}/social-accounts${query}`,
      );
    },

    disconnectOrgAccount(organizationId: number, accountId: number) {
      return client.delete<AccountResponse>(
        `/organizations/${organizationId}/social-accounts/${accountId}`,
      );
    },
  };
}

export type UserSocialApi = ReturnType<typeof createUserSocialApi>;
