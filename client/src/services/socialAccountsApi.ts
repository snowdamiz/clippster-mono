/**
 * Social Accounts API Service
 * Handles communication with the server for social media account management,
 * account assignments, and post submissions.
 */

import api from './api';

// ============================================
// Types - Social Accounts
// ============================================

export interface SocialAccountAssignment {
  id: number;
  user_id: number;
  assigned_at: string;
  user: {
    id: number;
    email: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
  assigned_by: {
    id: number;
    email: string;
    name: string | null;
  } | null;
}

export interface SocialAccount {
  id: number;
  platform: 'instagram' | 'tiktok' | 'twitter' | 'x' | 'youtube';
  platform_user_id: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  is_active: boolean;
  connected_at: string;
  token_expires_at: string | null;
  inserted_at: string;
  updated_at: string;
  assignments?: SocialAccountAssignment[];
}

export interface ListSocialAccountsResponse {
  success: boolean;
  accounts: SocialAccount[];
  error?: string;
}

export interface SocialAccountResponse {
  success: boolean;
  account?: SocialAccount;
  error?: string;
}

export interface AssignmentResponse {
  success: boolean;
  assigned?: number;
  total?: number;
  error?: string;
}

export interface ListAssignmentsResponse {
  success: boolean;
  assignments: SocialAccountAssignment[];
  error?: string;
}

// ============================================
// Types - Post Submissions
// ============================================

export interface PostAnalytics {
  view_count: number;
  like_count: number;
  comment_count: number;
  save_count: number;
  reach_count: number;
  impressions_count: number;
}

export interface PostSubmission {
  id: number;
  organization_id: number;
  platform: string;
  post_id: string | null;
  post_url: string | null;
  media_type: string | null;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  status: 'pending' | 'publishing' | 'published' | 'failed';
  error_message: string | null;
  posted_at: string | null;
  last_synced_at: string | null;
  manual_override: boolean;
  analytics: PostAnalytics;
  social_account: {
    id: number;
    platform: string;
    username: string;
    display_name: string | null;
    profile_image_url: string | null;
  } | null;
  creator_profile: {
    id: number;
    name: string;
    profile_image_url: string | null;
  } | null;
  submitted_by: {
    id: number;
    email: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
  inserted_at: string;
  updated_at: string;
}

export interface ListPostsResponse {
  success: boolean;
  posts: PostSubmission[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
}

export interface PostResponse {
  success: boolean;
  post?: PostSubmission;
  message?: string;
  error?: string;
}

export interface AnalyticsSummary {
  total_posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_saves: number;
  total_reach: number;
  total_impressions: number;
}

export interface AnalyticsSummaryResponse {
  success: boolean;
  summary?: AnalyticsSummary;
  error?: string;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
}

// ============================================
// Social Account API Functions
// ============================================

/**
 * List all social accounts for an organization.
 */
export async function listSocialAccounts(
  organizationId: string | number,
  includeInactive = false
): Promise<ListSocialAccountsResponse> {
  try {
    const params = includeInactive ? { include_inactive: 'true' } : {};
    const response = await api.get<ListSocialAccountsResponse>(
      `/organizations/${organizationId}/social-accounts`,
      { params }
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to list accounts:', error);
    return {
      success: false,
      accounts: [],
      error: error.response?.data?.error || error.message || 'Failed to list accounts',
    };
  }
}

/**
 * Get a single social account.
 */
export async function getSocialAccount(
  organizationId: string | number,
  accountId: number
): Promise<SocialAccountResponse> {
  try {
    const response = await api.get<SocialAccountResponse>(
      `/organizations/${organizationId}/social-accounts/${accountId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to get account:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get account',
    };
  }
}

/**
 * Complete a social account connection after OAuth callback.
 */
export async function completeSocialConnection(data: {
  organization_id: string | number;
  platform: string;
  platform_user_id: string;
  username: string;
  display_name?: string;
  profile_image_url?: string;
  access_token: string;
  token_expires_at?: string;
}): Promise<SocialAccountResponse> {
  try {
    const response = await api.post<SocialAccountResponse>('/auth/social/complete', data);
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to complete connection:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to complete connection',
    };
  }
}

/**
 * Create a social account manually (for testing or alternative flows).
 */
export async function createSocialAccount(
  organizationId: string | number,
  data: {
    platform: string;
    platform_user_id: string;
    username: string;
    display_name?: string;
    profile_image_url?: string;
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: string;
  }
): Promise<SocialAccountResponse> {
  try {
    const response = await api.post<SocialAccountResponse>(
      `/organizations/${organizationId}/social-accounts`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to create account:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create account',
    };
  }
}

/**
 * Update a social account.
 */
export async function updateSocialAccount(
  organizationId: string | number,
  accountId: number,
  data: {
    display_name?: string;
    is_active?: boolean;
  }
): Promise<SocialAccountResponse> {
  try {
    const response = await api.put<SocialAccountResponse>(
      `/organizations/${organizationId}/social-accounts/${accountId}`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to update account:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update account',
    };
  }
}

/**
 * Delete a social account.
 */
export async function deleteSocialAccount(
  organizationId: string | number,
  accountId: number
): Promise<DeleteResponse> {
  try {
    const response = await api.delete<DeleteResponse>(
      `/organizations/${organizationId}/social-accounts/${accountId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to delete account:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete account',
    };
  }
}

/**
 * Trigger token refresh for an account.
 */
export async function refreshAccountToken(
  organizationId: string | number,
  accountId: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await api.post<{ success: boolean; message?: string }>(
      `/organizations/${organizationId}/social-accounts/${accountId}/refresh`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to refresh token:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to refresh token',
    };
  }
}

// ============================================
// Account Assignment API Functions
// ============================================

/**
 * List assignments for a social account.
 */
export async function listAccountAssignments(
  organizationId: string | number,
  accountId: number
): Promise<ListAssignmentsResponse> {
  try {
    const response = await api.get<ListAssignmentsResponse>(
      `/organizations/${organizationId}/social-accounts/${accountId}/assignments`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to list assignments:', error);
    return {
      success: false,
      assignments: [],
      error: error.response?.data?.error || error.message || 'Failed to list assignments',
    };
  }
}

/**
 * Assign a social account to members.
 */
export async function assignSocialAccount(
  organizationId: string | number,
  accountId: number,
  userIds: number[]
): Promise<AssignmentResponse> {
  try {
    const response = await api.post<AssignmentResponse>(
      `/organizations/${organizationId}/social-accounts/${accountId}/assignments`,
      { user_ids: userIds }
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to assign account:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to assign account',
    };
  }
}

/**
 * Unassign a social account from a member.
 */
export async function unassignSocialAccount(
  organizationId: string | number,
  accountId: number,
  userId: number
): Promise<DeleteResponse> {
  try {
    const response = await api.delete<DeleteResponse>(
      `/organizations/${organizationId}/social-accounts/${accountId}/assignments/${userId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to unassign account:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to unassign account',
    };
  }
}

/**
 * Get accounts assigned to the current user in an organization.
 */
export async function getMyAssignedAccounts(
  organizationId: string | number
): Promise<ListSocialAccountsResponse> {
  try {
    const response = await api.get<ListSocialAccountsResponse>(
      `/organizations/${organizationId}/my-social-accounts`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to get assigned accounts:', error);
    return {
      success: false,
      accounts: [],
      error: error.response?.data?.error || error.message || 'Failed to get assigned accounts',
    };
  }
}

// ============================================
// Post Submission API Functions
// ============================================

/**
 * List post submissions for an organization.
 */
export async function listPostSubmissions(
  organizationId: string | number,
  options?: {
    creator_profile_id?: number;
    account_id?: number;
    platform?: string;
    status?: string;
    submitted_by_user_id?: number;
    limit?: number;
    offset?: number;
  }
): Promise<ListPostsResponse> {
  try {
    const response = await api.get<ListPostsResponse>(`/organizations/${organizationId}/posts`, {
      params: options,
    });
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to list posts:', error);
    return {
      success: false,
      posts: [],
      total: 0,
      limit: 50,
      offset: 0,
      error: error.response?.data?.error || error.message || 'Failed to list posts',
    };
  }
}

/**
 * Get a single post submission.
 */
export async function getPostSubmission(
  organizationId: string | number,
  postId: number
): Promise<PostResponse> {
  try {
    const response = await api.get<PostResponse>(
      `/organizations/${organizationId}/posts/${postId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to get post:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get post',
    };
  }
}

/**
 * Publish a clip to a social platform.
 */
export async function publishPost(
  organizationId: string | number,
  data: {
    social_account_id: number;
    creator_profile_id?: number;
    media_url: string;
    caption?: string;
    media_type?: 'image' | 'video' | 'reel';
    thumbnail_url?: string;
  }
): Promise<PostResponse> {
  try {
    const response = await api.post<PostResponse>(
      `/organizations/${organizationId}/posts/publish`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to publish post:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to publish post',
    };
  }
}

/**
 * Update post analytics manually.
 */
export async function updatePostAnalytics(
  organizationId: string | number,
  postId: number,
  analytics: Partial<PostAnalytics>
): Promise<PostResponse> {
  try {
    const response = await api.put<PostResponse>(
      `/organizations/${organizationId}/posts/${postId}`,
      analytics
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to update analytics:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update analytics',
    };
  }
}

/**
 * Trigger analytics sync for a post.
 */
export async function syncPostAnalytics(
  organizationId: string | number,
  postId: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await api.post<{ success: boolean; message?: string }>(
      `/organizations/${organizationId}/posts/${postId}/sync`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to sync analytics:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to sync analytics',
    };
  }
}

/**
 * Reset manual override on a post.
 */
export async function resetPostOverride(
  organizationId: string | number,
  postId: number
): Promise<PostResponse> {
  try {
    const response = await api.post<PostResponse>(
      `/organizations/${organizationId}/posts/${postId}/reset-override`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to reset override:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to reset override',
    };
  }
}

/**
 * Get analytics summary for an organization.
 */
export async function getAnalyticsSummary(
  organizationId: string | number,
  options?: {
    creator_profile_id?: number;
    days?: number;
  }
): Promise<AnalyticsSummaryResponse> {
  try {
    const response = await api.get<AnalyticsSummaryResponse>(
      `/organizations/${organizationId}/posts/analytics`,
      { params: options }
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to get analytics summary:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get analytics summary',
    };
  }
}

// ============================================
// Creator Profile API Functions
// ============================================

export interface AssignedCreatorProfile {
  id: number;
  organization_id: number;
  organization_name?: string;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  intro_id: number | null;
  outro_id: number | null;
  watermark_id: number | null;
  watermark_settings: string | null;
  inserted_at: string;
  updated_at: string;
}

export interface AssignedCreatorProfilesResponse {
  success: boolean;
  profiles: AssignedCreatorProfile[];
  error?: string;
}

/**
 * Get all creator profiles assigned to the current user across all their organizations.
 * Used by members to see which profiles they can use when publishing.
 */
export async function getMyAssignedCreatorProfiles(): Promise<AssignedCreatorProfilesResponse> {
  try {
    const response = await api.get<AssignedCreatorProfilesResponse>(
      '/user/assigned-creator-profiles'
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to get assigned creator profiles:', error);
    return {
      success: false,
      profiles: [],
      error:
        error.response?.data?.error || error.message || 'Failed to get assigned creator profiles',
    };
  }
}

export interface UploadMediaResponse {
  success: boolean;
  media_url?: string;
  thumbnail_url?: string;
  error?: string;
}

/**
 * Upload media for social post publishing.
 * Uploads the video/image to R2 storage and returns the public URL.
 */
export async function uploadMediaForPost(
  organizationId: string | number,
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
      `/organizations/${organizationId}/posts/upload-media`,
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[SocialAccountsApi] Failed to upload media:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload media',
    };
  }
}

// ============================================
// Social Account Connection via PostForMe OAuth
// ============================================

import { isTauri } from '@/lib/instagram-auth';

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
  account?: SocialAccount;
  accounts?: SocialAccount[];
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

/**
 * Get the API base URL
 */
function getApiBase(): string {
  return (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.clippster.app')
  );
}

/**
 * Get the auth token from local storage
 */
function getAuthToken(): string {
  return localStorage.getItem('auth_token') || '';
}

async function startPostForMeOrganizationOAuth(
  organizationId: string | number,
  platform: string,
  onResult?: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): Promise<() => void> {
  const { invoke } = await import('@tauri-apps/api/core');

  const connectResponse = await api.post<PostForMeConnectUrlResponse>('/social/connect-url', {
    organization_id: organizationId,
    platform,
  });

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
      const status = await pollOrganizationConnectStatus(
        organizationId,
        connectionId,
        () => cancelled
      );

      if (cancelled || !onResult) return;

      if (status.status !== 'synced') {
        onResult({
          success: false,
          error: status.error || 'Social account connection failed',
        });
        return;
      }

      const completeResponse = await api.post<PostForMeCompleteConnectResponse>(
        '/social/complete-connect',
        {
          organization_id: organizationId,
          connection_id: connectionId,
          platform,
        }
      );

      if (!completeResponse.data.success) {
        onResult({
          success: false,
          error: completeResponse.data.error || 'Failed to finalize social account connection',
        });
        return;
      }

      const account = completeResponse.data.account || completeResponse.data.accounts?.[0];

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

async function pollOrganizationConnectStatus(
  organizationId: string | number,
  connectionId: string,
  isCancelled: () => boolean
): Promise<PostForMeConnectStatusResponse> {
  const startedAt = Date.now();

  while (!isCancelled()) {
    const response = await api.get<PostForMeConnectStatusResponse>('/social/connect-status', {
      params: {
        organization_id: organizationId,
        connection_id: connectionId,
      },
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

/**
 * Start Instagram OAuth flow via PostForMe.
 * Returns a cleanup function.
 */
export async function startInstagramOAuthPopup(
  organizationId: string | number,
  onResult?: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): Promise<() => void> {
  if (!isTauri()) {
    throw new Error('Instagram OAuth is only supported in the Tauri desktop app');
  }

  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('You must be logged in to connect Instagram');
  }

  return startPostForMeOrganizationOAuth(organizationId, 'instagram', onResult);
}

/**
 * Start X (Twitter) OAuth flow via PostForMe.
 * Returns a cleanup function.
 */
export async function startTwitterOAuthPopup(
  organizationId: string | number,
  onResult?: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): Promise<() => void> {
  if (!isTauri()) {
    throw new Error('X OAuth is only supported in the Tauri desktop app');
  }

  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('You must be logged in to connect X');
  }

  return startPostForMeOrganizationOAuth(organizationId, 'x', onResult);
}

/**
 * Start TikTok OAuth flow.
 * Uses Post For Me provider flow.
 */
export async function startTiktokOAuthPopup(
  organizationId: string | number,
  onResult?: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): Promise<() => void> {
  if (!isTauri()) {
    throw new Error('TikTok OAuth is only supported in the Tauri desktop app');
  }

  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('You must be logged in to connect TikTok');
  }

  return startPostForMeOrganizationOAuth(organizationId, 'tiktok', onResult);
}

/**
 * Start YouTube OAuth flow.
 * Uses Post For Me provider flow.
 */
export async function startYoutubeOAuthPopup(
  organizationId: string | number,
  onResult?: (result: { success: boolean; account?: SocialAccount; error?: string }) => void
): Promise<() => void> {
  if (!isTauri()) {
    throw new Error('YouTube OAuth is only supported in the Tauri desktop app');
  }

  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('You must be logged in to connect YouTube');
  }

  return startPostForMeOrganizationOAuth(organizationId, 'youtube', onResult);
}

