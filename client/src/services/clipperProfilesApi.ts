import api from './api';

// ============================================================================
// Types
// ============================================================================

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
  endorsements?: Endorsement[];
  user?: {
    id: number;
    name: string;
    email: string;
    last_active_at?: string;
  };
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

export interface Endorsement {
  id: number;
  content: string | null;
  rating: number | null;
  organization: {
    id: number;
    name: string;
  } | null;
  endorsed_by: {
    id: number;
    name: string;
  } | null;
  inserted_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  score: number;
  clips_delivered: number;
  campaigns_active: number;
  endorsements_received: number;
  profile: {
    id: number;
    display_name: string;
    avatar_url: string | null;
    slug: string;
    is_verified: boolean;
    badges: Badge[];
  } | null;
}

// ============================================================================
// Constants
// ============================================================================

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'experienced', label: 'Experienced' },
  { value: 'professional', label: 'Professional' },
];

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
];

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
];

export const PREFERRED_PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'snapchat', label: 'Snapchat' },
];

export const CHANNEL_PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'kick', label: 'Kick' },
  { value: 'twitch', label: 'Twitch' },
];

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
];

// ============================================================================
// Response Types
// ============================================================================

interface ProfileResponse {
  success: boolean;
  profile: ClipperProfile;
  error?: string;
}

interface ProfilesResponse {
  success: boolean;
  profiles: ClipperProfile[];
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

interface LeaderboardResponse {
  success: boolean;
  period_type: string;
  entries: LeaderboardEntry[];
  error?: string;
}

interface EndorsementResponse {
  success: boolean;
  endorsement: Endorsement;
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// Own Profile API
// ============================================================================

export async function getMyClipperProfile(): Promise<ProfileResponse> {
  const response = await api.get('/user/clipper-profile');
  return response.data;
}

export async function updateMyClipperProfile(
  data: Partial<ClipperProfile>
): Promise<ProfileResponse> {
  const response = await api.put('/user/clipper-profile', data);
  return response.data;
}

// ============================================================================
// Channel Links API
// ============================================================================

export async function listChannelLinks(): Promise<ChannelLinksResponse> {
  const response = await api.get('/user/clipper-profile/channel-links');
  return response.data;
}

export async function createChannelLink(data: {
  platform: string;
  url: string;
  username?: string;
  display_order?: number;
}): Promise<ChannelLinkResponse> {
  try {
    const response = await api.post('/user/clipper-profile/channel-links', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to save channel link',
    };
  }
}

export async function updateChannelLink(
  id: number,
  data: {
    url?: string;
    username?: string;
    display_order?: number;
  }
): Promise<ChannelLinkResponse> {
  try {
    const response = await api.put(`/user/clipper-profile/channel-links/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update channel link',
    };
  }
}

export async function deleteChannelLink(id: number): Promise<DeleteResponse> {
  const response = await api.delete(`/user/clipper-profile/channel-links/${id}`);
  return response.data;
}

// ============================================================================
// Portfolio Clips API
// ============================================================================

export async function listPortfolioClips(): Promise<PortfolioClipsResponse> {
  const response = await api.get('/user/clipper-profile/portfolio-clips');
  return response.data;
}

export async function createPortfolioClip(data: {
  title?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  file_size?: number;
  display_order?: number;
}): Promise<PortfolioClipResponse> {
  const response = await api.post('/user/clipper-profile/portfolio-clips', data);
  return response.data;
}

export async function updatePortfolioClip(
  id: number,
  data: {
    title?: string;
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    file_size?: number;
    display_order?: number;
  }
): Promise<PortfolioClipResponse> {
  const response = await api.put(`/user/clipper-profile/portfolio-clips/${id}`, data);
  return response.data;
}

export async function deletePortfolioClip(id: number): Promise<DeleteResponse> {
  const response = await api.delete(`/user/clipper-profile/portfolio-clips/${id}`);
  return response.data;
}

interface UploadPortfolioClipResponse {
  success: boolean;
  portfolio_clip?: PortfolioClip;
  error?: string;
}

/**
 * Upload a portfolio clip video file to R2 storage.
 * Max file size: 200MB
 */
export async function uploadPortfolioClip(
  file: File,
  title?: string,
  thumbnail?: File
): Promise<UploadPortfolioClipResponse> {
  // Validate file size (200MB max)
  const MAX_SIZE = 200 * 1024 * 1024; // 200MB in bytes
  if (file.size > MAX_SIZE) {
    return {
      success: false,
      error: `File size exceeds 200MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
    };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    const response = await api.post<UploadPortfolioClipResponse>(
      '/user/clipper-profile/portfolio-clips/upload',
      formData
    );
    return response.data;
  } catch (error: any) {
    console.error('[ClipperProfilesApi] Failed to upload portfolio clip:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload portfolio clip',
    };
  }
}

// ============================================================================
// Presigned URL API (for video playback - bypasses R2 native URL auth)
// ============================================================================

export async function getPortfolioClipPresignedUrl(clipId: number): Promise<string | null> {
  try {
    const response = await api.get<{ success: boolean; url: string }>(
      `/user/clipper-profile/portfolio-clips/${clipId}/presigned-url`
    );
    return response.data.success ? response.data.url : null;
  } catch {
    return null;
  }
}

export async function getPublicPortfolioClipPresignedUrl(slug: string, clipId: number): Promise<string | null> {
  try {
    const response = await api.get<{ success: boolean; url: string }>(
      `/clippers/${slug}/portfolio-clips/${clipId}/presigned-url`
    );
    return response.data.success ? response.data.url : null;
  } catch {
    return null;
  }
}

export async function getPublicPortfolioClipThumbnailPresignedUrl(slug: string, clipId: number): Promise<string | null> {
  try {
    const response = await api.get<{ success: boolean; url: string }>(
      `/clippers/${slug}/portfolio-clips/${clipId}/thumbnail-presigned-url`
    );
    return response.data.success ? response.data.url : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Avatar Upload API
// ============================================================================

interface UploadAvatarResponse {
  success: boolean;
  profile?: ClipperProfile;
  avatar_url?: string;
  error?: string;
}

/**
 * Upload an avatar image to R2 storage.
 * Max file size: 5MB
 * Allowed types: JPEG, PNG, GIF, WebP
 */
export async function uploadClipperAvatar(file: File): Promise<UploadAvatarResponse> {
  // Validate file size (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > MAX_SIZE) {
    return {
      success: false,
      error: `File size exceeds 5MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
    };
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
    };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadAvatarResponse>(
      '/user/clipper-profile/avatar',
      formData
    );
    return response.data;
  } catch (error: any) {
    console.error('[ClipperProfilesApi] Failed to upload avatar:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload avatar',
    };
  }
}

// ============================================================================
// Public Directory API
// ============================================================================

export interface DirectoryFilters {
  looking_for_work?: boolean;
  experience_level?: string;
  specialty_tags?: string[];
  content_style_tags?: string[];
  preferred_platforms?: string[];
  languages?: string[];
  verified_only?: boolean;
}

export async function listClippers(filters?: DirectoryFilters): Promise<ProfilesResponse> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.looking_for_work !== undefined) {
      params.append('looking_for_work', String(filters.looking_for_work));
    }
    if (filters.experience_level) {
      params.append('experience_level', filters.experience_level);
    }
    if (filters.specialty_tags?.length) {
      params.append('specialty_tags', filters.specialty_tags.join(','));
    }
    if (filters.content_style_tags?.length) {
      params.append('content_style_tags', filters.content_style_tags.join(','));
    }
    if (filters.preferred_platforms?.length) {
      params.append('preferred_platforms', filters.preferred_platforms.join(','));
    }
    if (filters.languages?.length) {
      params.append('languages', filters.languages.join(','));
    }
    if (filters.verified_only) {
      params.append('verified_only', 'true');
    }
  }

  const queryString = params.toString();
  const url = queryString ? `/clippers?${queryString}` : '/clippers';
  const response = await api.get(url);
  return response.data;
}

export async function getClipperBySlug(slug: string): Promise<ProfileResponse> {
  const response = await api.get(`/clippers/${slug}`);
  return response.data;
}

export async function getLeaderboard(
  period: 'weekly' | 'monthly' = 'weekly'
): Promise<LeaderboardResponse> {
  const response = await api.get(`/clippers/leaderboard?period=${period}`);
  return response.data;
}

// ============================================================================
// Endorsements API
// ============================================================================

export async function createEndorsement(
  slug: string,
  organizationId: number,
  data: {
    content?: string;
    rating?: number;
    campaign_id?: number;
  }
): Promise<EndorsementResponse> {
  const response = await api.post(`/clippers/${slug}/endorsements`, {
    organization_id: organizationId,
    ...data,
  });
  return response.data;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getExperienceLevelLabel(value: string): string {
  return EXPERIENCE_LEVELS.find((l) => l.value === value)?.label || value;
}

export function getSpecialtyTagLabel(value: string): string {
  return SPECIALTY_TAGS.find((t) => t.value === value)?.label || value;
}

export function getContentStyleTagLabel(value: string): string {
  return CONTENT_STYLE_TAGS.find((t) => t.value === value)?.label || value;
}

export function getPlatformLabel(value: string): string {
  return (
    PREFERRED_PLATFORMS.find((p) => p.value === value)?.label ||
    CHANNEL_PLATFORMS.find((p) => p.value === value)?.label ||
    value
  );
}

export function getLanguageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name || code;
}

export function getBadgeLabel(badgeType: string): string {
  const labels: Record<string, string> = {
    verified: 'Verified Clipper',
    top_clipper: 'Top Clipper',
    rising_star: 'Rising Star',
  };
  return labels[badgeType] || badgeType;
}

export function getBadgeColor(badgeType: string): string {
  const colors: Record<string, string> = {
    verified: 'text-blue-500',
    top_clipper: 'text-amber-500',
    rising_star: 'text-purple-500',
  };
  return colors[badgeType] || 'text-muted-foreground';
}
