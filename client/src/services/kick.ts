import { invoke } from '@tauri-apps/api/core';
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

// ============================================================================
// Live Stream Functions (via Tauri backend)
// ============================================================================

/**
 * Live status response from Kick API
 */
export interface KickLiveStatus {
  isLive: boolean;
  channelId?: number;
  channelSlug?: string;
  username?: string;
  profileImageUrl?: string;
  streamTitle?: string;
  viewerCount?: number;
  thumbnailUrl?: string;
  playbackUrl?: string;
  startedAt?: string;
  error?: string;
}

/**
 * Check if a Kick channel is currently live
 * Uses the server API which proxies to RapidAPI (same as VOD fetching)
 * @param channel - Channel slug or URL
 * @returns Live status information
 */
export async function checkKickLivestream(channel: string): Promise<KickLiveStatus> {
  try {
    // Normalize channel slug (extract from URL if needed)
    const channelSlug = extractChannelSlug(channel) || channel.toLowerCase().trim();
    
    // Use server API (same RapidAPI as VOD fetching)
    const response = await api.get<KickLiveStatus>(`/kick/channels/${channelSlug}`);
    return response.data;
  } catch (error: any) {
    console.error('[Kick] Failed to check live status:', error);
    return { 
      isLive: false,
      error: error.response?.data?.error || error.message || 'Failed to check live status'
    };
  }
}

/**
 * Get the HLS stream URL for a live Kick channel
 * @param channel - Channel slug or full Kick URL
 * @returns The m3u8 playback URL
 */
export async function getKickStreamUrl(channel: string): Promise<string | null> {
  try {
    const result = await invoke<string>('get_kick_stream_url', { channel });
    return result;
  } catch (error) {
    console.error('[Kick] Failed to get stream URL:', error);
    return null;
  }
}

/**
 * Check if yt-dlp is available on the system
 * @returns true if yt-dlp is installed and working
 */
export async function checkYtdlpAvailable(): Promise<boolean> {
  try {
    const result = await invoke<boolean>('check_ytdlp_available');
    return result;
  } catch (error) {
    console.error('[Kick] Failed to check yt-dlp availability:', error);
    return false;
  }
}

/**
 * Get yt-dlp version information
 * @returns Version string or null if not available
 */
export async function getYtdlpVersion(): Promise<string | null> {
  try {
    const result = await invoke<string>('get_ytdlp_version');
    return result;
  } catch (error) {
    console.error('[Kick] Failed to get yt-dlp version:', error);
    return null;
  }
}

/**
 * Fetch live status for a Kick channel (alias for checkKickLivestream for consistency with PumpFun)
 */
export async function fetchKickLiveStatus(channel: string): Promise<KickLiveStatus> {
  return checkKickLivestream(channel);
}

/**
 * Start recording a Kick livestream using yt-dlp + FFmpeg
 * @param channelSlug - The Kick channel slug
 * @param streamerId - The internal streamer ID
 * @param sessionId - The recording session ID
 * @param segmentDurationMinutes - Duration of each segment in minutes (default: 5)
 */
export async function startKickRecording(
  channelSlug: string,
  streamerId: string,
  sessionId: string,
  segmentDurationMinutes?: number
): Promise<void> {
  await invoke('start_kick_recording', {
    channelSlug,
    streamerId,
    sessionId,
    segmentDurationMinutes,
  });
}

/**
 * Stop recording a Kick livestream
 * @param channelSlug - The Kick channel slug
 */
export async function stopKickRecording(channelSlug: string): Promise<void> {
  await invoke('stop_kick_recording', { channelSlug });
}

/**
 * Stop all active Kick recordings
 */
export async function stopAllKickRecordings(): Promise<void> {
  await invoke('stop_all_kick_recordings');
}
