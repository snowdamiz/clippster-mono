import type { ApiClient } from './createApiClient';

export interface BrandingConfig {
  [aspectRatio: string]: {
    watermark_id?: string;
    watermark_settings?: {
      position?: string;
      opacity?: number;
      scale?: number;
      margin?: number;
    };
    intro_id?: string;
    outro_id?: string;
  };
}

export interface SharedClip {
  id: number;
  organization_id: number;
  organization_name?: string;
  name: string;
  description: string | null;
  url?: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  branding_config: BrandingConfig;
  branding_required: boolean;
  expires_at: string;
  days_until_expiration: number;
  inserted_at: string;
  viewed_at?: string | null;
  downloaded_at?: string | null;
  posted_at?: string | null;
}

export interface ListSharedClipsResponse {
  success: boolean;
  clips: SharedClip[];
  error?: string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export function getExpirationBadgeColor(daysRemaining: number): 'green' | 'yellow' | 'red' {
  if (daysRemaining >= 5) return 'green';
  if (daysRemaining >= 2) return 'yellow';
  return 'red';
}

export function getExpirationText(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Expired';
  if (daysRemaining === 1) return 'Expires tomorrow';
  return `Expires in ${daysRemaining} days`;
}

export function createSharedClipsApi(client: ApiClient) {
  return {
    getUserSharedClips() {
      return client.get<ListSharedClipsResponse>('/user/shared-clips');
    },

    markViewed(clipId: number) {
      return client.post<ActionResponse>(`/shared-clips/${clipId}/mark-viewed`);
    },

    markDownloaded(clipId: number) {
      return client.post<ActionResponse>(`/shared-clips/${clipId}/mark-downloaded`);
    },

    markPosted(clipId: number) {
      return client.post<ActionResponse>(`/shared-clips/${clipId}/post`);
    },
  };
}

export type SharedClipsApi = ReturnType<typeof createSharedClipsApi>;
