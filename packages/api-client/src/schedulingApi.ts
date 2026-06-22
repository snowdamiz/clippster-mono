import type { ApiClient } from './createApiClient';

export type SocialPlatform = 'instagram' | 'tiktok' | 'twitter' | 'youtube';
export type ScheduledPostStatus =
  | 'pending'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'canceled';

export interface PostAnalytics {
  view_count: number;
  like_count: number;
  comment_count: number;
  save_count: number;
  reach_count: number;
  impressions_count: number;
}

export interface ScheduledPost {
  id: number;
  platform: SocialPlatform;
  status: ScheduledPostStatus;
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
  analytics: PostAnalytics;
  social_account: {
    id: number;
    platform: string;
    username: string;
    display_name?: string;
    profile_image_url?: string;
  } | null;
  creator_profile?: {
    id: number;
    name: string;
    profile_image_url?: string;
  } | null;
  organization?: {
    id: number;
    name: string;
    logo_url?: string;
  } | null;
  campaign?: {
    id: number;
    name: string;
  } | null;
  inserted_at: string;
  updated_at: string;
}

export interface SchedulePostData {
  platform: SocialPlatform;
  media_url: string;
  caption?: string;
  scheduled_at: string;
  media_type?: string;
  clip_id?: string;
  thumbnail_url?: string;
  user_social_account_id?: number;
  organization_id?: number;
  social_account_id?: number;
  creator_profile_id?: number;
  campaign_id?: number;
}

export interface UpdateScheduledPostData {
  caption?: string;
  scheduled_at?: string;
  user_social_account_id?: number;
}

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

export function formatScheduleDate(date: Date): string {
  return date.toISOString();
}

export function getMinScheduleTime(): Date {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  return now;
}

export function isValidScheduleTime(date: Date): boolean {
  return date >= getMinScheduleTime();
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) {
    if (diffMins > -60) return `${Math.abs(diffMins)} minutes ago`;
    if (diffHours > -24) return `${Math.abs(diffHours)} hours ago`;
    return `${Math.abs(diffDays)} days ago`;
  }

  if (diffMins < 60) return `in ${diffMins} minutes`;
  if (diffHours < 24) return `in ${diffHours} hours`;
  return `in ${diffDays} days`;
}

export function createSchedulingApi(client: ApiClient) {
  return {
    schedulePost(data: SchedulePostData) {
      return client.post<ScheduleResponse>('/social/schedule', data);
    },

    updateScheduledPostMedia(postIds: number[], mediaUrl: string, thumbnailUrl?: string) {
      return client.patch<{ success: boolean; updated: number; failed: number; error?: string }>(
        '/social/scheduled/update-media',
        {
          post_ids: postIds,
          media_url: mediaUrl,
          thumbnail_url: thumbnailUrl,
        },
      );
    },

    listScheduledPosts(status?: string) {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      return client.get<ScheduledPostsListResponse>(`/social/scheduled${query}`);
    },

    getScheduledPost(postId: number) {
      return client.get<ScheduleResponse>(`/social/scheduled/${postId}`);
    },

    updateScheduledPost(postId: number, data: UpdateScheduledPostData) {
      return client.put<ScheduleResponse>(`/social/scheduled/${postId}`, data);
    },

    cancelScheduledPost(postId: number) {
      return client.post<ScheduleResponse>(`/social/scheduled/${postId}/cancel`);
    },

    deleteScheduledPost(postId: number) {
      return client.delete<ScheduleResponse>(`/social/scheduled/${postId}`);
    },

    retryScheduledPost(postId: number) {
      return client.post<ScheduleResponse>(`/social/scheduled/${postId}/retry`);
    },

    listOrgScheduledPosts(
      organizationId: number,
      options?: { status?: string; limit?: number; offset?: number },
    ) {
      const params = new URLSearchParams();
      if (options?.status) params.set('status', options.status);
      if (options?.limit != null) params.set('limit', String(options.limit));
      if (options?.offset != null) params.set('offset', String(options.offset));
      const query = params.toString();
      return client.get<ScheduledPostsListResponse & { total?: number }>(
        `/organizations/${organizationId}/scheduled-posts${query ? `?${query}` : ''}`,
      );
    },
  };
}

export type SchedulingApi = ReturnType<typeof createSchedulingApi>;
