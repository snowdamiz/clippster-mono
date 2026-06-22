import type { ApiClient } from './createApiClient';

export interface ClipperProfile {
  id: number;
  user_id: number;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  slug: string | null;
  is_public: boolean;
  looking_for_work: boolean;
  experience_level: string | null;
  specialty_tags: string[];
  content_style_tags: string[];
  preferred_platforms: string[];
  languages: string[];
  timezone: string | null;
  response_time_hours: number | null;
  is_verified: boolean;
  total_campaigns_completed: number;
  total_clips_delivered: number;
  total_endorsements: number;
  channel_links: ChannelLink[];
  portfolio_clips: PortfolioClip[];
  badges: Badge[];
  is_affiliate: boolean;
  inserted_at: string;
  updated_at: string;
}

export interface ChannelLink {
  id: number;
  platform: string;
  url: string;
  username: string | null;
  display_order: number;
}

export interface PortfolioClip {
  id: number;
  title: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  display_order: number;
}

export interface Badge {
  id: number;
  badge_type: string;
  earned_at: string;
  expires_at: string | null;
}

export interface ReactNativeUploadFile {
  uri: string;
  name: string;
  type: string;
}

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'experienced', label: 'Experienced' },
  { value: 'professional', label: 'Professional' },
] as const;

export const SPECIALTY_TAGS = [
  { value: 'gaming', label: 'Gaming' },
  { value: 'irl', label: 'IRL' },
  { value: 'just-chatting', label: 'Just Chatting' },
  { value: 'esports', label: 'Esports' },
  { value: 'music', label: 'Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'news', label: 'News' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'educational', label: 'Educational' },
  { value: 'asmr', label: 'ASMR' },
  { value: 'creative', label: 'Creative' },
  { value: 'podcasts', label: 'Podcasts' },
] as const;

export const CONTENT_STYLE_TAGS = [
  { value: 'meme', label: 'Meme' },
  { value: 'clean', label: 'Clean' },
  { value: 'effects', label: 'Effects' },
  { value: 'subtitles', label: 'Subtitles' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'highlights', label: 'Highlights' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'compilations', label: 'Compilations' },
  { value: 'dramatic', label: 'Dramatic' },
] as const;

export const PREFERRED_PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'snapchat', label: 'Snapchat' },
] as const;

export const CHANNEL_PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'kick', label: 'Kick' },
  { value: 'twitch', label: 'Twitch' },
] as const;

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'it', name: 'Italian' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
] as const;

export const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

interface ProfileResponse {
  success: boolean;
  profile: ClipperProfile;
  error?: string;
}

interface ChannelLinksResponse {
  success: boolean;
  channel_links: ChannelLink[];
  error?: string;
}

interface ChannelLinkResponse {
  success: boolean;
  channel_link?: ChannelLink;
  error?: string;
}

interface PortfolioClipsResponse {
  success: boolean;
  portfolio_clips: PortfolioClip[];
  error?: string;
}

interface PortfolioClipResponse {
  success: boolean;
  portfolio_clip: PortfolioClip;
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  error?: string;
}

interface UploadAvatarResponse {
  success: boolean;
  profile?: ClipperProfile;
  avatar_url?: string;
  error?: string;
}

interface UploadPortfolioClipResponse {
  success: boolean;
  portfolio_clip?: PortfolioClip;
  error?: string;
}

export function getExperienceLevelLabel(value: string): string {
  return EXPERIENCE_LEVELS.find((l) => l.value === value)?.label ?? value;
}

export function getSpecialtyTagLabel(value: string): string {
  return SPECIALTY_TAGS.find((t) => t.value === value)?.label ?? value;
}

export function getContentStyleTagLabel(value: string): string {
  return CONTENT_STYLE_TAGS.find((t) => t.value === value)?.label ?? value;
}

export function getPlatformLabel(value: string): string {
  return (
    PREFERRED_PLATFORMS.find((p) => p.value === value)?.label ??
    CHANNEL_PLATFORMS.find((p) => p.value === value)?.label ??
    value
  );
}

export function createClipperProfilesApi(client: ApiClient) {
  return {
    getMyProfile() {
      return client.get<ProfileResponse>('/user/clipper-profile');
    },

    updateMyProfile(data: Partial<ClipperProfile>) {
      return client.put<ProfileResponse>('/user/clipper-profile', data);
    },

    listChannelLinks() {
      return client.get<ChannelLinksResponse>('/user/clipper-profile/channel-links');
    },

    createChannelLink(data: {
      platform: string;
      url: string;
      username?: string;
      display_order?: number;
    }) {
      return client.post<ChannelLinkResponse>('/user/clipper-profile/channel-links', data);
    },

    updateChannelLink(
      id: number,
      data: { url?: string; username?: string; display_order?: number },
    ) {
      return client.put<ChannelLinkResponse>(`/user/clipper-profile/channel-links/${id}`, data);
    },

    deleteChannelLink(id: number) {
      return client.delete<DeleteResponse>(`/user/clipper-profile/channel-links/${id}`);
    },

    listPortfolioClips() {
      return client.get<PortfolioClipsResponse>('/user/clipper-profile/portfolio-clips');
    },

    createPortfolioClip(data: {
      title?: string;
      video_url: string;
      thumbnail_url?: string;
      duration?: number;
      file_size?: number;
      display_order?: number;
    }) {
      return client.post<PortfolioClipResponse>('/user/clipper-profile/portfolio-clips', data);
    },

    deletePortfolioClip(id: number) {
      return client.delete<DeleteResponse>(`/user/clipper-profile/portfolio-clips/${id}`);
    },

    uploadAvatar(file: ReactNativeUploadFile) {
      const formData = new FormData();
      formData.append('file', file as unknown as Blob);
      return client.post<UploadAvatarResponse>('/user/clipper-profile/avatar', formData);
    },

    uploadPortfolioClip(file: ReactNativeUploadFile, title?: string, thumbnail?: ReactNativeUploadFile) {
      const formData = new FormData();
      formData.append('file', file as unknown as Blob);
      if (title) formData.append('title', title);
      if (thumbnail) formData.append('thumbnail', thumbnail as unknown as Blob);
      return client.post<UploadPortfolioClipResponse>(
        '/user/clipper-profile/portfolio-clips/upload',
        formData,
      );
    },

    getPortfolioClipPresignedUrl(clipId: number) {
      return client.get<{ success: boolean; url: string }>(
        `/user/clipper-profile/portfolio-clips/${clipId}/presigned-url`,
      );
    },

    getClipperBySlug(slug: string) {
      return client.get<ProfileResponse>(`/clippers/${slug}`);
    },
  };
}

export type ClipperProfilesApi = ReturnType<typeof createClipperProfilesApi>;
