/**
 * User Twitter (X) API Service
 * Handles user-level X account connections for clippers.
 * Mirrors the userInstagramApi.ts pattern.
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface UserTwitterAccount {
  id: number;
  platform: 'twitter';
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

export interface TwitterAuthResult {
  success: boolean;
  account?: UserTwitterAccount;
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
  social_account?: UserTwitterAccount;
  social_accounts?: UserTwitterAccount[];
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

/**
 * Get authentication token from local storage
 */
function getAuthToken(): string {
  return localStorage.getItem('auth_token') || '';
}

/**
 * Start X (Twitter) OAuth flow for user account connection.
 * Opens OAuth in system browser and listens for result via Tauri event.
 */
export async function startUserTwitterOAuth(
  onResult?: (result: TwitterAuthResult) => void
): Promise<() => void> {
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('Not authenticated');
  }

  // Dynamic import to handle Tauri-specific code
  const { invoke } = await import('@tauri-apps/api/core');

  try {
    // Preferred flow: Post For Me generic OAuth
    const connectResponse = await api.post<PostForMeConnectUrlResponse>(
      '/user/social/connect-url',
      { platform: 'x' }
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
            platform: 'x',
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
  } catch (postForMeError: any) {
    const message =
      postForMeError?.response?.data?.error ||
      postForMeError?.message ||
      'Failed to create Post For Me auth URL';

    console.error('[UserTwitterApi] Post For Me connect failed:', message);
    throw new Error(message);
  }
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
 * List user's connected X (Twitter) accounts.
 * Uses the same /user/social-accounts endpoint, filtered to twitter platform.
 */
export async function listUserTwitterAccounts(): Promise<{
  success: boolean;
  accounts: UserTwitterAccount[];
  error?: string;
}> {
  const response = await api.get('/user/social-accounts');
  return {
    ...response.data,
    accounts: (response.data.social_accounts || []).filter(
      (acc: any) => acc.platform === 'x' || acc.platform === 'twitter'
    ),
  };
}

/**
 * Disconnect a user X (Twitter) account
 */
export async function disconnectUserTwitterAccount(
  accountId: number
): Promise<{ success: boolean; error?: string }> {
  const response = await api.delete(`/user/social-accounts/${accountId}`);
  return response.data;
}

// ============================================
// Publishing API
// ============================================

export interface PublishToUserTwitterData {
  account_id: number;
  media_url: string;
  caption?: string;
  media_type?: string;
  thumbnail_url?: string;
  creator_profile_id?: number;
  campaign_id?: number;
}

export interface PublishToUserTwitterResponse {
  success: boolean;
  post?: any;
  message?: string;
  error?: string;
}

/**
 * Publish a post to user's personal X (Twitter) account.
 */
export async function publishToUserTwitter(
  data: PublishToUserTwitterData
): Promise<PublishToUserTwitterResponse> {
  console.log('[UserTwitterApi] publishToUserTwitter called with data:', data);
  try {
    console.log('[UserTwitterApi] Making POST request to /user/twitter/publish');
    const response = await api.post<PublishToUserTwitterResponse>('/user/twitter/publish', data);
    console.log('[UserTwitterApi] Received response:', response);
    console.log('[UserTwitterApi] Response data:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('[UserTwitterApi] Failed to publish to X:', error);
    console.error('[UserTwitterApi] Error details:', {
      message: error.message,
      response: error.response,
      request: error.request,
      config: error.config
    });
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to publish to X',
    };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if account token is expiring soon
 */
export function isTwitterTokenExpiringSoon(account: UserTwitterAccount): boolean {
  if (!account.token_expires_at) return false;

  const expiresAt = new Date(account.token_expires_at);
  const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  return daysUntilExpiry < 7;
}
