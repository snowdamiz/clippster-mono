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
  const { listen } = await import('@tauri-apps/api/event');

  try {
    // Start OAuth - Tauri will open browser and handle callback
    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.clippster.app');
    await invoke('start_user_twitter_oauth', { apiBase, authToken });

    // Listen for the result
    const unlisten = await listen<TwitterAuthResult>('twitter-auth-complete', (event) => {
      if (onResult) {
        onResult(event.payload);
      }
    });

    // Return cleanup function
    return unlisten;
  } catch (error) {
    console.error('Failed to start X OAuth:', error);
    throw error;
  }
}

// ============================================
// Account Management API
// ============================================

/**
 * List user's connected X (Twitter) accounts.
 * Uses the same /user/social-accounts endpoint, filtered to twitter platform.
 */
export async function listUserTwitterAccounts(): Promise<{ success: boolean; accounts: UserTwitterAccount[]; error?: string }> {
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
export async function disconnectUserTwitterAccount(accountId: number): Promise<{ success: boolean; error?: string }> {
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
export async function publishToUserTwitter(data: PublishToUserTwitterData): Promise<PublishToUserTwitterResponse> {
  try {
    const response = await api.post<PublishToUserTwitterResponse>('/user/twitter/publish', data);
    return response.data;
  } catch (error: any) {
    console.error('[UserTwitterApi] Failed to publish to X:', error);
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
