import { invoke } from '@tauri-apps/api/core';

export interface RumbleLiveStatus {
  isLive: boolean;
  channelName?: string;
  streamTitle?: string;
  viewerCount?: number;
  thumbnailUrl?: string;
  startedAt?: string;
}

export interface RumbleVod {
  videoId: string;
  title?: string;
  duration?: number;
  viewCount?: number;
  thumbnailUrl?: string;
  uploadDate?: string;
  url: string;
}

/**
 * Extract Rumble channel name from URL
 */
export function extractRumbleChannel(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('rumble.com')) {
        return null;
      }

      // Handle /c/channelname format
      if (url.pathname.includes('/c/')) {
        const parts = url.pathname.split('/c/');
        if (parts.length > 1) {
          return 'c/' + parts[1].split('/')[0];
        }
      }

      // Handle /user/channelname format
      if (url.pathname.includes('/user/')) {
        const parts = url.pathname.split('/user/');
        if (parts.length > 1) {
          return 'user/' + parts[1].split('/')[0];
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  // Plain channel name — assume /c/ format
  return trimmed;
}

/**
 * Check if a Rumble channel is currently live
 */
export async function checkRumbleLivestream(channel: string): Promise<RumbleLiveStatus> {
  try {
    const channelName = extractRumbleChannel(channel) || channel.trim();
    const result = await invoke<string>('check_rumble_livestream', { channel: channelName });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[Rumble] Failed to check live status:', error);
    return {
      isLive: false,
    };
  }
}

/**
 * Get VODs for a Rumble channel
 */
export async function getRumbleVods(channel: string, limit: number = 20): Promise<RumbleVod[]> {
  try {
    const channelName = extractRumbleChannel(channel) || channel.trim();
    const result = await invoke<string>('get_rumble_vods', { channel: channelName, limit });
    return JSON.parse(result);
  } catch (error: unknown) {
    console.error('[Rumble] Failed to get VODs:', error);
    return [];
  }
}

/**
 * Download a Rumble VOD
 */
export async function downloadRumbleVod(
  vodUrl: string,
  outputPath: string,
  downloadId: string
): Promise<void> {
  await invoke('download_rumble_vod', {
    vodUrl,
    outputPath,
    downloadId,
  });
}

/**
 * Start recording a Rumble livestream
 */
export async function startRumbleRecording(
  channel: string,
  streamerId: string,
  sessionId: string,
  segmentDurationMinutes?: number
): Promise<void> {
  await invoke('start_rumble_recording', {
    channel,
    streamerId,
    sessionId,
    segmentDurationMinutes,
  });
}

/**
 * Stop recording a Rumble livestream
 */
export async function stopRumbleRecording(channel: string): Promise<void> {
  await invoke('stop_rumble_recording', { channel });
}

/**
 * Stop all active Rumble recordings
 */
export async function stopAllRumbleRecordings(): Promise<void> {
  await invoke('stop_all_rumble_recordings');
}

/**
 * Get the output directory for a Rumble session
 */
export async function getRumbleSessionOutputDir(sessionId: string): Promise<string> {
  return invoke<string>('get_rumble_session_output_dir', { sessionId });
}

/**
 * Get list of active Rumble recordings
 */
export async function getActiveRumbleRecordings(): Promise<string[]> {
  return invoke<string[]>('get_active_rumble_recordings');
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
