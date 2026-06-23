/**
 * User YouTube API Service
 * Handles user-level YouTube account connections via Post For Me.
 * Mirrors the userTwitterApi.ts pattern.
 */

import api from './api';
import { buildUserConnectUrlBody, type UserSocialConnectOptions } from './userSocialConnect';

// ============================================
// Types
// ============================================

export interface UserYoutubeAccount {
  id: number;
  platform: 'youtube';
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

export interface YoutubeAuthResult {
  success: boolean;
  account?: UserYoutubeAccount;
  error?: string;
}

interface PostForMeConnectUrlResponse {
  success: boolean;
  connection_id?: string;
  auth_url?: string;
  external_id?: string;
  platform?: string;
  error?: string;
}

interface PostForMeCompleteConnectResponse {
  success: boolean;
  social_account?: UserYoutubeAccount;
  social_accounts?: UserYoutubeAccount[];
  error?: string;
}

interface PostForMeConnectStatusResponse {
  success: boolean;
  connection_id?: string;
  status?: 'pending' | 'callback_received' | 'synced' | 'failed' | 'expired';
  session_success?: boolean | null;
  account_ids?: string[];
  external_id?: string;
  platform?: string;
  error?: string;
}

const POST_FOR_ME_STATUS_POLL_INTERVAL_MS = 1500;
const POST_FOR_ME_STATUS_TIMEOUT_MS = 180000;

// ============================================
// OAuth Functions
// ============================================

function getAuthToken(): string {
  return localStorage.getItem('auth_token') || '';
}

/**
 * Start YouTube OAuth flow for user account connection.
 * Opens OAuth in system browser and polls for result.
 */
export async function startUserYoutubeOAuth(
  onResult?: (result: YoutubeAuthResult) => void,
  options?: UserSocialConnectOptions
): Promise<() => void> {
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const { invoke } = await import('@tauri-apps/api/core');

  const connectResponse = await api.post<PostForMeConnectUrlResponse>(
    '/user/social/connect-url',
    buildUserConnectUrlBody('youtube', options)
  );

  if (!connectResponse.data.success || !connectResponse.data.auth_url) {
    throw new Error(connectResponse.data.error || 'Failed to create Post For Me auth URL');
  }

  const connectionId = connectResponse.data.connection_id;

  if (!connectionId) {
    throw new Error('Post For Me response did not include connection_id');
  }

  await invoke('start_post_for_me_oauth', { authUrl: connectResponse.data.auth_url });

  let cancelled = false;

  void (async () => {
    try {
      const status = await pollUserConnectStatus(connectionId, () => cancelled);

      if (cancelled || !onResult) return;

      if (status.status !== 'synced') {
        onResult({
          success: false,
          error: status.error || 'Social account connection failed',
        });
        return;
      }

      const completeResponse = await api.post<PostForMeCompleteConnectResponse>(
        '/user/social/complete-connect',
        {
          connection_id: connectionId,
          platform: 'youtube',
        }
      );

      if (!completeResponse.data.success) {
        onResult({
          success: false,
          error: completeResponse.data.error || 'Failed to finalize social account connection',
        });
        return;
      }

      const account =
        completeResponse.data.social_account || completeResponse.data.social_accounts?.[0];

      onResult({
        success: true,
        account,
      });
    } catch (error: any) {
      if (cancelled || !onResult) return;

      onResult({
        success: false,
        error:
          error.response?.data?.error ||
          error.message ||
          'Failed to complete social account connection',
      });
    }
  })();

  return () => {
    cancelled = true;
  };
}

async function pollUserConnectStatus(
  connectionId: string,
  isCancelled: () => boolean
): Promise<PostForMeConnectStatusResponse> {
  const startedAt = Date.now();

  while (!isCancelled()) {
    const response = await api.get<PostForMeConnectStatusResponse>('/user/social/connect-status', {
      params: { connection_id: connectionId },
    });

    const status = response.data;

    if (!status.success) {
      throw new Error(status.error || 'Failed to fetch connection status');
    }

    if (status.status === 'synced' || status.status === 'failed' || status.status === 'expired') {
      return status;
    }

    if (Date.now() - startedAt > POST_FOR_ME_STATUS_TIMEOUT_MS) {
      throw new Error('Timed out waiting for account connection');
    }

    await new Promise((resolve) => setTimeout(resolve, POST_FOR_ME_STATUS_POLL_INTERVAL_MS));
  }

  throw new Error('Connection polling cancelled');
}

// ============================================
// Account Management API
// ============================================

/**
 * List user's connected YouTube accounts.
 * Uses the same /user/social-accounts endpoint, filtered to youtube platform.
 */
export async function listUserYoutubeAccounts(): Promise<{
  success: boolean;
  accounts: UserYoutubeAccount[];
  error?: string;
}> {
  const response = await api.get('/user/social-accounts');
  return {
    ...response.data,
    accounts: (response.data.social_accounts || []).filter(
      (acc: any) => acc.platform === 'youtube'
    ),
  };
}

/**
 * Disconnect a user YouTube account
 */
export async function disconnectUserYoutubeAccount(
  accountId: number
): Promise<{ success: boolean; error?: string }> {
  const response = await api.delete(`/user/social-accounts/${accountId}`);
  return response.data;
}

// ============================================
// Publishing API
// ============================================

export interface PublishToUserYoutubeData {
  account_id: number;
  media_url: string;
  title: string;
  caption?: string;
  media_type?: string;
  thumbnail_url?: string;
  privacy?: 'public' | 'unlisted' | 'private';
  made_for_kids?: boolean;
  category_id?: string;
  creator_profile_id?: number;
  campaign_id?: number;
  clip_id?: string;
  clip_build_id?: string;
}

export interface PublishToUserYoutubeResponse {
  success: boolean;
  post?: any;
  message?: string;
  error?: string;
}

/**
 * Publish a post to user's personal YouTube account.
 */
export async function publishToUserYoutube(
  data: PublishToUserYoutubeData
): Promise<PublishToUserYoutubeResponse> {
  try {
    const response = await api.post<PublishToUserYoutubeResponse>('/user/youtube/publish', data);
    return response.data;
  } catch (error: any) {
    console.error('[UserYoutubeApi] Failed to publish to YouTube:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to publish to YouTube',
    };
  }
}

