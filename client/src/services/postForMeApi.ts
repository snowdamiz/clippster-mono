/**
 * Post for Me API Service
 * Client-side service for Post for Me integration (Instagram, TikTok, YouTube).
 * All calls go through our server which proxies to the PFM API.
 */

import api from './api';
import type { SocialAccount } from './socialAccountsApi';
import {
  isTauri,
  startPfmOAuth,
  startPfmUserOAuth,
  onPfmAuthComplete as onTauriPfmAuthComplete,
  type PfmPlatform,
  type PfmAuthResult,
} from '@/lib/postforme-auth';

// ============================================
// Types
// ============================================

export interface PfmUploadUrlResponse {
  success: boolean;
  data?: {
    upload_url: string;
    media_url: string;
  };
  error?: string;
}

export interface PfmInstagramConfig {
  placement?: 'reels' | 'story' | 'timeline';
  collaborators?: string[];
  share_to_feed?: boolean;
  location?: string;
}

export interface PfmTikTokConfig {
  privacy_level?: 'public' | 'friends' | 'self';
  allow_comment?: boolean;
  allow_duet?: boolean;
  allow_stitch?: boolean;
  is_draft?: boolean;
  is_ai_generated?: boolean;
  auto_add_music?: boolean;
}

export interface PfmYouTubeConfig {
  title?: string;
  privacy_status?: 'public' | 'private' | 'unlisted';
  made_for_kids?: boolean;
  tags?: string[];
  category_id?: string;
  playlist_id?: string;
}

export interface PfmCreatePostParams {
  social_account_ids: string[];
  media_url: string;
  text?: string;
  caption?: string;
  scheduled_at?: string;
  platform?: string;
  media_type?: string;
  thumbnail_url?: string;
  instagram_config?: PfmInstagramConfig;
  tiktok_config?: PfmTikTokConfig;
  youtube_config?: PfmYouTubeConfig;
  social_account_configs?: Record<string, any>;

  // Local tracking fields
  organization_id?: number | string;
  social_account_id?: number | string;
  creator_profile_id?: number | string;
  campaign_id?: number | string;
  user_social_account_id?: number | string;
}

export interface PfmPostResponse {
  success: boolean;
  post?: {
    id: number;
    pfm_post_id: string;
    platform: string;
    status: string;
    caption: string | null;
  };
  pfm_post_id?: string;
  warning?: string;
  error?: string;
}

export interface PfmAccountFeedResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface PfmAccountsResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface PfmPostResultsResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================
// Media Upload
// ============================================

/**
 * Get a presigned upload URL from Post for Me.
 * Client uploads the file directly to this URL.
 */
export async function createUploadUrl(
  fileName: string,
  fileSize: number,
  contentType: string
): Promise<PfmUploadUrlResponse> {
  try {
    const response = await api.post<PfmUploadUrlResponse>('/postforme/media/upload-url', {
      file_name: fileName,
      file_size: fileSize,
      content_type: contentType,
    });
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to create upload URL:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create upload URL',
    };
  }
}

/**
 * Upload a file to the PFM presigned URL.
 * This goes directly to PFM storage, not through our server.
 */
export async function uploadToPfm(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  try {
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  } catch (error: any) {
    console.error('[PostForMeApi] Upload failed:', error);
    return false;
  }
}

/**
 * Full upload flow: get presigned URL, upload file, return media URL.
 */
export async function uploadMedia(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; mediaUrl?: string; error?: string }> {
  // Step 1: Get upload URL
  const urlResult = await createUploadUrl(file.name, file.size, file.type);
  if (!urlResult.success || !urlResult.data) {
    return { success: false, error: urlResult.error || 'Failed to get upload URL' };
  }

  // Step 2: Upload the file
  const uploaded = await uploadToPfm(urlResult.data.upload_url, file, onProgress);
  if (!uploaded) {
    return { success: false, error: 'Failed to upload file' };
  }

  return { success: true, mediaUrl: urlResult.data.media_url };
}

// ============================================
// Posts
// ============================================

/**
 * Create and publish a post via Post for Me.
 */
export async function createPost(params: PfmCreatePostParams): Promise<PfmPostResponse> {
  try {
    const response = await api.post<PfmPostResponse>('/postforme/posts', params);
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to create post:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create post',
    };
  }
}

/**
 * List posts from Post for Me.
 */
export async function listPosts(params?: {
  social_account_id?: string;
  status?: string;
  cursor?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await api.get('/postforme/posts', { params });
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to list posts:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to list posts',
    };
  }
}

/**
 * Get a single post from Post for Me.
 */
export async function getPost(pfmPostId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await api.get(`/postforme/posts/${pfmPostId}`);
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to get post:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get post',
    };
  }
}

// ============================================
// Analytics
// ============================================

/**
 * Get the feed for a PFM social account with metrics.
 */
export async function getAccountFeed(
  pfmAccountId: string,
  params?: { expand?: string; cursor?: string }
): Promise<PfmAccountFeedResponse> {
  try {
    const response = await api.get(`/postforme/accounts/${pfmAccountId}/feed`, { params });
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to get account feed:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get feed',
    };
  }
}

/**
 * Get post results (publish outcomes).
 */
export async function getPostResults(params?: {
  social_post_id?: string;
  cursor?: string;
}): Promise<PfmPostResultsResponse> {
  try {
    const response = await api.get('/postforme/post-results', { params });
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to get post results:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get post results',
    };
  }
}

// ============================================
// Accounts
// ============================================

/**
 * List PFM social accounts.
 */
export async function listAccounts(params?: {
  platform?: string;
  cursor?: string;
}): Promise<PfmAccountsResponse> {
  try {
    const response = await api.get('/postforme/accounts', { params });
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to list accounts:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to list accounts',
    };
  }
}

/**
 * Disconnect a PFM social account.
 */
export async function disconnectAccount(
  pfmAccountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.post(`/postforme/accounts/${pfmAccountId}/disconnect`);
    return response.data;
  } catch (error: any) {
    console.error('[PostForMeApi] Failed to disconnect account:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to disconnect account',
    };
  }
}

// ============================================
// OAuth Helpers
// ============================================

function getApiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.clippster.app');
}

function getAuthToken(): string {
  return localStorage.getItem('auth_token') || '';
}

/**
 * Start Post for Me OAuth flow for an organization account.
 * Returns a cleanup function.
 */
export async function startPfmOAuthPopup(
  platform: PfmPlatform,
  organizationId: string | number,
  onResult?: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): Promise<() => void> {
  if (!isTauri()) {
    throw new Error('Post for Me OAuth is only supported in the Tauri desktop app');
  }

  const apiBase = getApiBase();
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('You must be logged in to connect social accounts');
  }

  return startPfmOAuth(platform, organizationId, apiBase, authToken, (result: PfmAuthResult) => {
    if (onResult) {
      onResult({
        success: result.success,
        account: result.account as SocialAccount | undefined,
        error: result.error,
      });
    }
  });
}

/**
 * Start Post for Me OAuth flow for a user-level account (no org).
 * Returns a cleanup function.
 */
export async function startPfmUserOAuthPopup(
  platform: PfmPlatform,
  onResult?: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): Promise<() => void> {
  if (!isTauri()) {
    throw new Error('Post for Me OAuth is only supported in the Tauri desktop app');
  }

  const apiBase = getApiBase();
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('You must be logged in to connect social accounts');
  }

  return startPfmUserOAuth(platform, apiBase, authToken, (result: PfmAuthResult) => {
    if (onResult) {
      onResult({
        success: result.success,
        account: result.account as SocialAccount | undefined,
        error: result.error,
      });
    }
  });
}

/**
 * Listen for Post for Me OAuth completion events.
 * Returns cleanup function to remove listener.
 */
export function onPfmAuthComplete(
  callback: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): () => void {
  if (!isTauri()) {
    return () => {};
  }

  return onTauriPfmAuthComplete((result: PfmAuthResult) => {
    callback({
      success: result.success,
      account: result.account as SocialAccount | undefined,
      error: result.error,
    });
  });
}

// Re-export types
export type { PfmPlatform, PfmAuthResult, PfmAccount } from '@/lib/postforme-auth';
