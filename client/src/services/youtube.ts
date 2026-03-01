import { invoke } from '@tauri-apps/api/core';

export interface YouTubeLiveStatus {
  isLive: boolean;
  channelId?: string;
  channelName?: string;
  displayName?: string;
  profileImageUrl?: string;
  streamTitle?: string;
  viewerCount?: string;
  thumbnailUrl?: string;
  startedAt?: string;
}

export interface YouTubeVod {
  videoId: string;
  title?: string;
  duration?: number;
  viewCount?: number;
  thumbnailUrl?: string;
  uploadDate?: string;
  url: string;
}

/**
 * Extract YouTube channel ID or handle from URL
 */
export function extractYouTubeChannel(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('youtube.com') && !url.hostname.includes('youtu.be')) {
        return null;
      }

      // Handle /channel/UC... format
      if (url.pathname.includes('/channel/')) {
        const parts = url.pathname.split('/channel/');
        if (parts.length > 1) {
          return parts[1].split('/')[0];
        }
      }

      // Handle /@username format
      if (url.pathname.includes('/@')) {
        const parts = url.pathname.split('/@');
        if (parts.length > 1) {
          return '@' + parts[1].split('/')[0];
        }
      }

      // Handle /user/username format
      if (url.pathname.includes('/user/')) {
        const parts = url.pathname.split('/user/');
        if (parts.length > 1) {
          return parts[1].split('/')[0];
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  // Handle @username format
  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  // Handle UC... channel ID format
  if (trimmed.startsWith('UC') && trimmed.length === 24) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Check if a YouTube channel is currently live
 */
export async function checkYouTubeLivestream(channel: string): Promise<YouTubeLiveStatus> {
  try {
    const channelId = extractYouTubeChannel(channel) || channel.trim();
    const result = await invoke<string>('check_youtube_livestream', { channel: channelId });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[YouTube] Failed to check live status:', error);
    return {
      isLive: false,
    };
  }
}

export interface YouTubeChannelInfo {
  channelId: string;
  channelName?: string;
  displayName?: string;
  profileImageUrl?: string;
}

export async function getYouTubeChannelInfo(channel: string): Promise<YouTubeChannelInfo | null> {
  try {
    const channelId = extractYouTubeChannel(channel) || channel.trim();
    const result = await invoke<string>('get_youtube_channel_info', { channel: channelId });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[YouTube] Failed to fetch channel info:', error);
    return null;
  }
}

/**
 * Get VODs (past live streams) for a YouTube channel
 */
export async function getYouTubeVods(channel: string, limit: number = 20): Promise<YouTubeVod[]> {
  try {
    const channelId = extractYouTubeChannel(channel) || channel.trim();
    const result = await invoke<string>('get_youtube_vods', { channel: channelId, limit });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[YouTube] Failed to get VODs:', error);
    return [];
  }
}

/**
 * Get regular videos (not live streams) for a YouTube channel
 */
export async function getYouTubeVideos(channel: string, limit: number = 20): Promise<YouTubeVod[]> {
  try {
    const channelId = extractYouTubeChannel(channel) || channel.trim();
    const result = await invoke<string>('get_youtube_videos', { channel: channelId, limit });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[YouTube] Failed to get videos:', error);
    return [];
  }
}

/**
 * Download a YouTube VOD
 */
export async function downloadYouTubeVod(
  downloadId: string,
  title: string,
  vodUrl: string,
  channelName: string
): Promise<void> {
  await invoke('download_youtube_vod', {
    downloadId,
    title,
    vodUrl,
    channelName,
  });
}

/**
 * Start recording a YouTube livestream
 */
export async function startYouTubeRecording(
  channel: string,
  streamerId: string,
  sessionId: string,
  segmentDurationMinutes?: number
): Promise<void> {
  await invoke('start_youtube_recording', {
    channel,
    streamerId,
    sessionId,
    segmentDurationMinutes,
  });
}

/**
 * Stop recording a YouTube livestream (stops ALL sessions for this channel)
 */
export async function stopYouTubeRecording(channel: string): Promise<void> {
  await invoke('stop_youtube_recording', { channel });
}

/**
 * Stop a specific YouTube recording session by session_id
 * Unlike stopYouTubeRecording which stops ALL sessions for a channel,
 * this only stops the one specific session, leaving others untouched.
 */
export async function stopYouTubeRecordingSession(sessionId: string): Promise<void> {
  await invoke('stop_youtube_recording_session', { sessionId });
}

/**
 * Stop all active YouTube recordings
 */
export async function stopAllYouTubeRecordings(): Promise<void> {
  await invoke('stop_all_youtube_recordings');
}

/**
 * Get the output directory for a YouTube session
 */
export async function getYouTubeSessionOutputDir(sessionId: string): Promise<string> {
  return invoke<string>('get_youtube_session_output_dir', { sessionId });
}

/**
 * Get list of active YouTube recordings
 */
export async function getActiveYouTubeRecordings(): Promise<string[]> {
  return invoke<string[]>('get_active_youtube_recordings');
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
