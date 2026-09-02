import type { ApiClient } from './createApiClient';
import type { SocialPlatform } from './schedulingApi';

export interface ReactNativeUploadFile {
  uri: string;
  name: string;
  type: string;
}

export interface UserPost {
  id: number;
  platform: SocialPlatform | 'x';
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
  published_at: string | null;
  synced_at: string | null;
  inserted_at: string;
  updated_at: string;
}

export interface UploadMediaResponse {
  success: boolean;
  media_url?: string;
  thumbnail_url?: string;
  error?: string;
}

export interface ListPostsResponse {
  success: boolean;
  posts: UserPost[];
  error?: string;
}

export function formatMetricCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function createUserPostsApi(client: ApiClient) {
  return {
    listPosts(accountId?: number) {
      const query = accountId ? `?account_id=${accountId}` : '';
      return client.get<ListPostsResponse>(`/user/posts${query}`);
    },

    uploadMedia(file: ReactNativeUploadFile, thumbnail?: ReactNativeUploadFile) {
      const formData = new FormData();
      formData.append('file', file as unknown as Blob);
      if (thumbnail) {
        formData.append('thumbnail', thumbnail as unknown as Blob);
      }
      return client.post<UploadMediaResponse>('/user/posts/upload-media', formData);
    },
  };
}

export type UserPostsApi = ReturnType<typeof createUserPostsApi>;
