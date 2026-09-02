import type { ApiClient } from './createApiClient';

export type TokendMode = 'mock' | 'local' | 'live';

export interface TokendServerCapabilities {
  public_catalog?: boolean;
  live_status?: boolean;
  oauth_connect?: boolean;
  mock_connect?: boolean;
  publish?: boolean;
  schedule?: boolean;
  download?: boolean;
  watch?: boolean;
  dvr?: boolean;
  analytics?: boolean;
  webhooks?: boolean;
}

export interface TokendModeInfo {
  mode: TokendMode;
  configured: boolean;
  oauth_ready?: boolean;
  oauth_incomplete?: boolean;
  missing_oauth_configuration?: string[];
  capabilities?: TokendServerCapabilities;
  message?: string;
}

export interface TokendCatalogItem {
  id: string;
  title: string;
  duration?: number;
  thumbnailUrl?: string | null;
  url: string;
  publishedAt?: string | null;
  kind: 'stream' | 'video';
}

export interface TokendCatalog {
  mode: string;
  slug: string;
  displayName: string;
  avatarUrl?: string | null;
  streams: TokendCatalogItem[];
  videos: TokendCatalogItem[];
  note?: string;
  source?: string;
}

export interface TokendLiveStatus {
  mode?: string;
  isLive: boolean;
  channelId?: string;
  displayName?: string;
  profileImageUrl?: string | null;
  streamTitle?: string | null;
  viewerCount?: number;
  thumbnailUrl?: string | null;
  startedAt?: string | null;
  error?: string;
  note?: string;
}

export interface TokendConnectUrlResponse {
  success: boolean;
  connection_id?: string;
  auth_url?: string;
  external_id?: string;
  platform?: string;
  error?: string;
  message?: string;
}

export interface TokendConnectResponse {
  success: boolean;
  social_account?: {
    id: number;
    platform: string;
    username: string;
    display_name: string | null;
    profile_image_url: string | null;
    is_active: boolean;
  };
  error?: string;
  message?: string;
}

export interface TokendMediaGrantResponse {
  success: boolean;
  token?: string;
  download_url?: string;
  expires_at?: string;
  error?: string;
}

export interface TokendPublishResponse {
  success: boolean;
  post?: unknown;
  error?: string;
  message?: string;
}

export type TokendConnectOptions = {
  return_mode?: 'dashboard' | 'tauri' | 'web' | 'mobile';
  return_url?: string;
};

export function createTokendApi(client: ApiClient) {
  return {
    getMode() {
      return client.get<TokendModeInfo>('/tokend/mode', { skipAuth: true });
    },

    getCatalog(slug: string) {
      return client.get<TokendCatalog>(`/tokend/channels/${encodeURIComponent(slug)}`, {
        skipAuth: true,
      });
    },

    getLiveStatus(slug: string) {
      return client.get<TokendLiveStatus>(`/tokend/channels/${encodeURIComponent(slug)}/live`, {
        skipAuth: true,
      });
    },

    getConnectUrl(options?: TokendConnectOptions) {
      return client.post<TokendConnectUrlResponse>('/user/tokend/connect-url', {
        return_mode: options?.return_mode,
        return_url: options?.return_url,
      });
    },

    getConnectStatus(connectionId: string) {
      return client.get<{
        success: boolean;
        connection_id?: string;
        status?: 'pending' | 'callback_received' | 'synced' | 'failed' | 'expired';
        error?: string;
        error_message?: string;
      }>(`/user/social/connect-status?connection_id=${encodeURIComponent(connectionId)}`);
    },

    mockConnect() {
      return client.post<TokendConnectResponse>('/user/tokend/connect', {});
    },

    getOrgConnectUrl(organizationId: number, options?: TokendConnectOptions) {
      return client.post<TokendConnectUrlResponse>(
        `/organizations/${organizationId}/tokend/connect-url`,
        {
          return_mode: options?.return_mode,
          return_url: options?.return_url,
        },
      );
    },

    mockOrgConnect(organizationId: number) {
      return client.post<TokendConnectResponse>(`/organizations/${organizationId}/tokend/connect`, {});
    },

    createMediaGrant(type: string, id: string, purpose = 'download') {
      return client.post<TokendMediaGrantResponse>(
        `/user/tokend/media/${encodeURIComponent(type)}/${encodeURIComponent(id)}/grants`,
        { purpose },
      );
    },

    publish(data: {
      account_id: number;
      media_url: string;
      caption?: string;
      media_type?: string;
      thumbnail_url?: string;
    }) {
      return client.post<TokendPublishResponse>('/user/tokend/publish', data);
    },
  };
}

export type TokendApi = ReturnType<typeof createTokendApi>;
