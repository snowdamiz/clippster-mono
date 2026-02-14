import { invoke } from '@tauri-apps/api/core';

export interface TwitchLiveStatus {
  isLive: boolean;
  channelId?: string;
  channelName?: string;
  displayName?: string;
  profileImageUrl?: string;
  streamTitle?: string;
  viewerCount?: number;
  gameName?: string;
  startedAt?: string;
}

export interface TwitchVod {
  vodId: string;
  title?: string;
  duration?: number; // in seconds
  viewCount?: number;
  thumbnailUrl?: string;
  createdAt?: string;
  url: string;
}

/**
 * Extract channel name from a Twitch URL
 */
export function extractChannelName(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('twitch.tv')) {
        return null;
      }

      const parts = url.pathname.split('/').filter((p) => p.length > 0);
      if (parts.length > 0) {
        // Skip paths like /videos/123456
        if (parts[0] === 'videos') return null;
        return parts[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  // Basic channel name validation (alphanumeric + underscore, 4-25 chars)
  if (/^[a-zA-Z0-9_]{4,25}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}

/**
 * Check if a Twitch channel is currently live
 * Uses Twitch's public GQL endpoint (no API key needed)
 */
export async function checkTwitchLivestream(channel: string): Promise<TwitchLiveStatus> {
  try {
    const channelName = extractChannelName(channel) || channel.toLowerCase().trim();
    const result = await invoke<string>('check_twitch_livestream', { channel: channelName });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[Twitch] Failed to check live status:', error);
    return {
      isLive: false,
    };
  }
}

/**
 * Get VODs for a Twitch channel
 * Uses yt-dlp to fetch VOD list
 */
export async function getTwitchVods(channel: string, limit: number = 20): Promise<TwitchVod[]> {
  try {
    const channelName = extractChannelName(channel) || channel.toLowerCase().trim();
    const result = await invoke<string>('get_twitch_vods', { channel: channelName, limit });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[Twitch] Failed to get VODs:', error);
    return [];
  }
}

/**
 * Start recording a Twitch livestream
 */
export async function startTwitchRecording(
  channelName: string,
  streamerId: string,
  sessionId: string,
  segmentDurationMinutes?: number,
  resumeDir?: string
): Promise<void> {
  await invoke('start_twitch_recording', {
    channelName,
    streamerId,
    sessionId,
    segmentDurationMinutes,
    resumeDir: resumeDir || null,
  });
}

/**
 * Stop recording a Twitch livestream
 */
export async function stopTwitchRecording(channelName: string): Promise<void> {
  await invoke('stop_twitch_recording', { channelName });
}

/**
 * Stop all active Twitch recordings
 */
export async function stopAllTwitchRecordings(): Promise<void> {
  await invoke('stop_all_twitch_recordings');
}

/**
 * Get the output directory for a Twitch session
 */
export async function getTwitchSessionOutputDir(sessionId: string): Promise<string> {
  return invoke<string>('get_twitch_session_output_dir', { sessionId });
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds?: number): string {
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

/**
 * Format relative time from date string
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Unknown';

  try {
    // Handle YYYYMMDD format from yt-dlp
    let date: Date;
    if (/^\d{8}$/.test(dateString)) {
      const year = parseInt(dateString.slice(0, 4));
      const month = parseInt(dateString.slice(4, 6)) - 1;
      const day = parseInt(dateString.slice(6, 8));
      date = new Date(year, month, day);
    } else {
      date = new Date(dateString);
    }

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

/**
 * Fetch live status for a Twitch channel (alias for consistency with other platforms)
 */
export async function fetchTwitchLiveStatus(channel: string): Promise<TwitchLiveStatus> {
  return checkTwitchLivestream(channel);
}
