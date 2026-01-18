/**
 * User Instagram API Service
 * Handles user-level Instagram account connections and post publishing
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface UserInstagramAccount {
  id: number;
  platform: 'instagram';
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

export interface UserPost {
  id: number;
  platform: 'instagram';
  post_id: string;
  post_url: string | null;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  media_type: 'image' | 'video' | 'reel';
  status: 'published' | 'failed';
  view_count: number;
  like_count: number;
  comment_count: number;
  save_count: number;
  reach_count: number;
  impressions_count: number;
  synced_at: string | null;
  published_at: string;
}

export interface PublishPostData {
  account_id: number;
  media_url: string;
  caption?: string;
  thumbnail_url?: string;
  media_type?: 'image' | 'video' | 'reel';
}

export interface UploadMediaResponse {
  success: boolean;
  media_url?: string;
  thumbnail_url?: string;
  error?: string;
}

// Response types
export interface ListAccountsResponse {
  success: boolean;
  accounts: UserInstagramAccount[];
  error?: string;
}

export interface AccountResponse {
  success: boolean;
  account?: UserInstagramAccount;
  error?: string;
}

export interface ListPostsResponse {
  success: boolean;
  posts: UserPost[];
  error?: string;
}

export interface PostResponse {
  success: boolean;
  post?: UserPost;
  message?: string;
  error?: string;
}

export interface InstagramAuthResult {
  success: boolean;
  account?: UserInstagramAccount;
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
 * Start Instagram OAuth flow for user account connection.
 * Opens OAuth in system browser and polls for result.
 */
export async function startUserInstagramOAuth(
  onResult?: (result: InstagramAuthResult) => void
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
    await invoke('start_user_instagram_oauth', { authToken });

    // Listen for the result
    const unlisten = await listen<InstagramAuthResult>('instagram-auth-complete', (event) => {
      if (onResult) {
        onResult(event.payload);
      }
    });

    // Return cleanup function
    return unlisten;
  } catch (error) {
    console.error('Failed to start Instagram OAuth:', error);
    throw error;
  }
}

// ============================================
// Account Management API
// ============================================

/**
 * List user's connected Instagram accounts
 */
export async function listUserInstagramAccounts(): Promise<ListAccountsResponse> {
  const response = await api.get('/user/social-accounts');
  return {
    ...response.data,
    // Filter to only Instagram accounts
    accounts: (response.data.social_accounts || []).filter(
      (acc: any) => acc.platform === 'instagram'
    ),
  };
}

/**
 * Disconnect a user Instagram account
 */
export async function disconnectUserInstagramAccount(accountId: number): Promise<AccountResponse> {
  const response = await api.delete(`/user/social-accounts/${accountId}`);
  return response.data;
}

/**
 * Refresh access token for an account
 */
export async function refreshUserAccountToken(accountId: number): Promise<AccountResponse> {
  // This would need a backend endpoint to trigger token refresh
  // For now, returning a placeholder
  const response = await api.post(`/user/social-accounts/${accountId}/refresh`);
  return response.data;
}

// ============================================
// Publishing API
// ============================================

/**
 * Upload media for user post publishing.
 * Uploads the video/image to R2 storage and returns the public URL.
 */
export async function uploadUserMediaForPost(
  file: File,
  thumbnail?: File
): Promise<UploadMediaResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    const response = await api.post<UploadMediaResponse>(
      '/user/posts/upload-media',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[UserInstagramApi] Failed to upload media:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload media',
    };
  }
}

/**
 * Publish a post to user's Instagram account
 */
export async function publishToUserInstagram(data: PublishPostData): Promise<PostResponse> {
  const response = await api.post('/user/instagram/publish', {
    account_id: data.account_id,
    media_url: data.media_url,
    caption: data.caption || '',
    thumbnail_url: data.thumbnail_url,
    media_type: data.media_type || 'reel',
  });
  return response.data;
}

// ============================================
// Posts & Analytics API
// ============================================

/**
 * List user's published posts
 */
export async function listUserPosts(accountId?: number): Promise<ListPostsResponse> {
  const params = accountId ? { account_id: accountId } : {};
  const response = await api.get('/user/posts', { params });
  return response.data;
}

/**
 * Get a specific post
 */
export async function getUserPost(postId: number): Promise<PostResponse> {
  const response = await api.get(`/user/posts/${postId}`);
  return response.data;
}

/**
 * Manually sync analytics for a post
 */
export async function syncPostAnalytics(postId: number): Promise<PostResponse> {
  const response = await api.post(`/user/posts/${postId}/sync`);
  return response.data;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if account token is expiring soon
 */
export function isTokenExpiringSoon(account: UserInstagramAccount): boolean {
  if (!account.token_expires_at) return false;

  const expiresAt = new Date(account.token_expires_at);
  const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  return daysUntilExpiry < 7;
}

/**
 * Format follower count
 */
export function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Format date
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}
