import api from './api';

export interface KickClip {
  clipId: string;
  sessionId: string;
  title: string;
  duration: number; // in seconds
  thumbnailUrl?: string;
  playlistUrl?: string;
  mp4Url?: string;
  clipType: 'COMPLETE' | 'HIGHLIGHT';
  startTime?: string;
  createdAt?: string;
  isLive?: boolean;
  views?: number;
}

export interface KickClipsResponse {
  success: boolean;
  clips: KickClip[];
  hasMore: boolean;
  total: number;
  error?: string;
}

/**
 * Extract channel slug from a Kick URL
 */
export function extractChannelSlug(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('kick.com')) {
        return null;
      }

      const parts = url.pathname.split('/').filter((p) => p.length > 0);
      if (parts.length > 0) {
        if (parts[0] === 'video') return null;
        return parts[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  // Basic slug validation
  if (/^[a-zA-Z0-9_-]{3,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Fetch Kick clips via the server API (which proxies to RapidAPI)
 */
export async function getKickClips(
  channelSlug: string,
  limit: number = 20
): Promise<KickClipsResponse> {
  try {
    // Call our server endpoint
    const response = await api.get<KickClipsResponse>(`/kick/channels/${channelSlug}/videos`, {
      params: { limit },
    });

    return response.data;
  } catch (error: any) {
    console.error('[Kick] Server API error:', error);
    return {
      success: false,
      clips: [],
      hasMore: false,
      total: 0,
      error: error.response?.data?.error || error.message || 'Failed to fetch clips',
    };
  }
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Unknown';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  } catch {
    return 'Unknown';
  }
}
