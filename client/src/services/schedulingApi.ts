/**
 * Scheduling API Service
 * Handles scheduling, updating, and canceling social media posts
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface ScheduledPost {
  id: number;
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube';
  status: 'pending' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled';
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  media_type: 'image' | 'video' | 'reel' | 'carousel' | 'story';
  owner_type: 'org' | 'user';
  clip_id: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  post_id: string | null;
  post_url: string | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  can_edit: boolean;
  can_cancel: boolean;
  analytics: {
    view_count: number;
    like_count: number;
    comment_count: number;
    save_count: number;
    reach_count: number;
    impressions_count: number;
  };
  social_account: {
    id: number;
    platform: string;
    username: string;
    display_name?: string;
    profile_image_url?: string;
  } | null;
  inserted_at: string;
  updated_at: string;
}

export interface ExternalPostSubmission {
  id: number;
  platform: string;
  post_url: string;
  post_id: string | null;
  caption: string | null;
  media_type: string | null;
  clip_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  reviewed_at: string | null;
  analytics: {
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    save_count: number;
  };
  submitted_by: {
    id: number;
    email: string;
    name?: string;
    avatar_url?: string;
  } | null;
  reviewed_by: {
    id: number;
    email: string;
    name?: string;
    avatar_url?: string;
  } | null;
  creator_profile: {
    id: number;
    name: string;
    profile_image_url?: string;
  } | null;
  campaign: {
    id: number;
    name: string;
  } | null;
  inserted_at: string;
  updated_at: string;
}

export interface SchedulePostData {
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube';
  media_url: string;
  caption?: string;
  scheduled_at: string;
  media_type?: string;
  clip_id?: string;
  thumbnail_url?: string;

  // For org posts
  organization_id?: number;
  social_account_id?: number;
  creator_profile_id?: number;
  campaign_id?: number;

  // For personal posts
  user_social_account_id?: number;
}

export interface UpdateScheduledPostData {
  caption?: string;
  scheduled_at?: string;
  social_account_id?: number;
  user_social_account_id?: number;
}

export interface SubmitExternalPostData {
  platform: string;
  post_url: string;
  caption?: string;
  media_type?: string;
  creator_profile_id?: number;
  campaign_id?: number;
  clip_id?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  save_count?: number;
  notes?: string;
}

// Response types
export interface ScheduleResponse {
  success: boolean;
  post?: ScheduledPost;
  message?: string;
  error?: string;
}

export interface ScheduledPostsListResponse {
  success: boolean;
  posts: ScheduledPost[];
  error?: string;
}

export interface ExternalPostsListResponse {
  success: boolean;
  submissions: ExternalPostSubmission[];
  total: number;
  error?: string;
}

export interface ExternalPostResponse {
  success: boolean;
  submission?: ExternalPostSubmission;
  message?: string;
  error?: string;
}

// ============================================
// Scheduling API
// ============================================

/**
 * Schedule a post for future publishing
 */
export async function schedulePost(data: SchedulePostData): Promise<ScheduleResponse> {
  const response = await api.post('/social/schedule', data);
  return response.data;
}

/**
 * List user's scheduled posts
 */
export async function listScheduledPosts(status?: string): Promise<ScheduledPostsListResponse> {
  const params = status ? { status } : {};
  const response = await api.get('/social/scheduled', { params });
  return response.data;
}

/**
 * Get a single scheduled post
 */
export async function getScheduledPost(postId: number): Promise<ScheduleResponse> {
  const response = await api.get(`/social/scheduled/${postId}`);
  return response.data;
}

/**
 * Update a scheduled post
 */
export async function updateScheduledPost(
  postId: number,
  data: UpdateScheduledPostData
): Promise<ScheduleResponse> {
  const response = await api.put(`/social/scheduled/${postId}`, data);
  return response.data;
}

/**
 * Cancel a scheduled post
 */
export async function cancelScheduledPost(postId: number): Promise<ScheduleResponse> {
  const response = await api.post(`/social/scheduled/${postId}/cancel`);
  return response.data;
}

/**
 * Retry a failed scheduled post
 */
export async function retryScheduledPost(postId: number): Promise<ScheduleResponse> {
  const response = await api.post(`/social/scheduled/${postId}/retry`);
  return response.data;
}

/**
 * List scheduled posts for an organization (admin view)
 */
export async function listOrgScheduledPosts(
  organizationId: number | string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ScheduledPostsListResponse & { total?: number }> {
  const response = await api.get(`/organizations/${organizationId}/scheduled-posts`, {
    params: options,
  });
  return response.data;
}

// ============================================
// External Post Submissions (Link Submissions)
// ============================================

/**
 * Submit an external post link to an organization
 */
export async function submitExternalPost(
  organizationId: number | string,
  data: SubmitExternalPostData
): Promise<ExternalPostResponse> {
  const response = await api.post(`/organizations/${organizationId}/external-posts`, data);
  return response.data;
}

/**
 * List external post submissions for an organization
 */
export async function listExternalPosts(
  organizationId: number | string,
  options?: {
    status?: string;
    creator_profile_id?: number;
    campaign_id?: number;
    limit?: number;
    offset?: number;
  }
): Promise<ExternalPostsListResponse> {
  const response = await api.get(`/organizations/${organizationId}/external-posts`, {
    params: options,
  });
  return response.data;
}

/**
 * Approve an external post submission
 */
export async function approveExternalPost(
  organizationId: number | string,
  submissionId: number
): Promise<ExternalPostResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/external-posts/${submissionId}/approve`
  );
  return response.data;
}

/**
 * Reject an external post submission
 */
export async function rejectExternalPost(
  organizationId: number | string,
  submissionId: number,
  notes?: string
): Promise<ExternalPostResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/external-posts/${submissionId}/reject`,
    { notes }
  );
  return response.data;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format a date to ISO string for scheduling
 */
export function formatScheduleDate(date: Date): string {
  return date.toISOString();
}

/**
 * Get minimum allowed schedule time (5 minutes from now)
 */
export function getMinScheduleTime(): Date {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  return now;
}

/**
 * Check if a date is valid for scheduling
 */
export function isValidScheduleTime(date: Date): boolean {
  const minTime = getMinScheduleTime();
  return date >= minTime;
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) {
    // Past
    if (diffMins > -60) return `${Math.abs(diffMins)} minutes ago`;
    if (diffHours > -24) return `${Math.abs(diffHours)} hours ago`;
    return `${Math.abs(diffDays)} days ago`;
  } else {
    // Future
    if (diffMins < 60) return `in ${diffMins} minutes`;
    if (diffHours < 24) return `in ${diffHours} hours`;
    return `in ${diffDays} days`;
  }
}

/**
 * Get status color class
 */
export function getStatusColor(status: ScheduledPost['status']): string {
  switch (status) {
    case 'scheduled':
      return 'text-blue-400';
    case 'publishing':
      return 'text-yellow-400';
    case 'published':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    case 'canceled':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get status badge class
 */
export function getStatusBadgeClass(status: ScheduledPost['status']): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'publishing':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'published':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'failed':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'canceled':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}
