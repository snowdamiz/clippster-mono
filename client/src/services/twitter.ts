import { invoke } from '@tauri-apps/api/core';

/**
 * Extract Twitter username from URL or handle
 */
export function extractTwitterUsername(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('twitter.com') && !url.hostname.includes('x.com')) {
        return null;
      }

      // Extract username from path (e.g., /username or /username/status/...)
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && !pathParts[0].startsWith('i')) {
        return pathParts[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  // Handle @username format
  if (trimmed.startsWith('@')) {
    return trimmed.substring(1);
  }

  // Plain username
  return trimmed;
}

/**
 * Validate and normalize a Twitter/X URL
 */
export async function validateTwitterUrl(url: string): Promise<string> {
  return invoke<string>('validate_twitter_url', { url });
}

/**
 * Extract broadcast or space ID from Twitter URL
 */
export function extractTwitterBroadcastId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();

  // Handle broadcast URLs
  if (trimmed.includes('/i/broadcasts/')) {
    const parts = trimmed.split('/i/broadcasts/');
    if (parts.length > 1) {
      return parts[1].split('/')[0].split('?')[0];
    }
  }

  // Handle Space URLs
  if (trimmed.includes('/i/spaces/')) {
    const parts = trimmed.split('/i/spaces/');
    if (parts.length > 1) {
      return parts[1].split('/')[0].split('?')[0];
    }
  }

  return null;
}

/**
 * Determine if URL is a broadcast (video) or Space (audio)
 */
export function getTwitterBroadcastType(url: string): 'broadcast' | 'space' | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  if (url.includes('/i/broadcasts/')) {
    return 'broadcast';
  }

  if (url.includes('/i/spaces/')) {
    return 'space';
  }

  return null;
}

/**
 * Normalize Twitter/X URL (convert x.com to twitter.com)
 */
export function normalizeTwitterUrl(url: string): string {
  return url.trim().replace('x.com', 'twitter.com');
}

/**
 * Start recording a Twitter broadcast or Space
 */
export async function startTwitterRecording(
  url: string,
  streamerId: string,
  sessionId: string,
  segmentDurationMinutes?: number
): Promise<void> {
  await invoke('start_twitter_recording', {
    url,
    streamerId,
    sessionId,
    segmentDurationMinutes,
  });
}

/**
 * Stop recording a Twitter broadcast or Space
 */
export async function stopTwitterRecording(url: string): Promise<void> {
  await invoke('stop_twitter_recording', { url });
}

/**
 * Stop all active Twitter recordings
 */
export async function stopAllTwitterRecordings(): Promise<void> {
  await invoke('stop_all_twitter_recordings');
}

/**
 * Get the output directory for a Twitter session
 */
export async function getTwitterSessionOutputDir(sessionId: string): Promise<string> {
  return invoke<string>('get_twitter_session_output_dir', { sessionId });
}

/**
 * Get list of active Twitter recordings
 */
export async function getActiveTwitterRecordings(): Promise<string[]> {
  return invoke<string[]>('get_active_twitter_recordings');
}

/**
 * Get Twitter user avatar as data URL (bypasses CORS by using Tauri backend)
 */
async function getTwitterUserAvatar(username: string): Promise<string | undefined> {
  try {
    // Use unavatar.io via Tauri to bypass CORS
    const avatarUrl = `https://unavatar.io/twitter/${username}`;
    const dataUrl = await invoke<string>('download_twitter_thumbnail', { 
      thumbnailUrl: avatarUrl 
    });
    return dataUrl;
  } catch (error) {
    console.warn('[Twitter] Failed to fetch user avatar:', error);
    return undefined;
  }
}

/**
 * Get metadata for a Twitter broadcast/space
 */
export async function getTwitterBroadcastInfo(url: string): Promise<{
  title?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  username?: string;
  description?: string;
  avatarUrl?: string;
}> {
  try {
    const result = await invoke<string>('get_twitter_broadcast_info', { url });
    const metadata = JSON.parse(result);
    
    console.log('[Twitter] Raw metadata from yt-dlp:', metadata);
    
    // Try multiple thumbnail fields
    let thumbnailUrl = metadata.thumbnail || 
                      metadata.thumbnails?.[0]?.url ||
                      (Array.isArray(metadata.thumbnails) && metadata.thumbnails.length > 0 
                        ? metadata.thumbnails[metadata.thumbnails.length - 1]?.url 
                        : undefined);
    
    // Download thumbnail as data URL to avoid expiring JWT tokens
    let thumbnail: string | undefined;
    if (thumbnailUrl) {
      try {
        console.log('[Twitter] Downloading thumbnail:', thumbnailUrl);
        thumbnail = await invoke<string>('download_twitter_thumbnail', { 
          thumbnailUrl 
        });
        console.log('[Twitter] Thumbnail downloaded successfully');
      } catch (error) {
        console.warn('[Twitter] Failed to download thumbnail:', error);
        thumbnail = undefined;
      }
    }
    
    // Extract username from uploader or channel
    const uploader = metadata.uploader || metadata.channel || metadata.uploader_id;
    const username = metadata.uploader_id || 
                    (uploader ? `@${uploader.replace('@', '')}` : undefined);
    
    // Try to get duration from metadata first
    let duration = metadata.duration;
    if (typeof duration === 'string') {
      duration = parseFloat(duration);
    }
    if (isNaN(duration) || duration === null || duration === undefined) {
      duration = undefined;
    }
    
    // If duration not in metadata, try to get it from the manifest URL using ffprobe
    if (!duration && metadata.manifest_url) {
      try {
        console.log('[Twitter] Duration not in metadata, fetching from manifest:', metadata.manifest_url);
        duration = await invoke<number>('get_twitter_broadcast_duration', { 
          manifestUrl: metadata.manifest_url 
        });
        console.log('[Twitter] Duration from ffprobe:', duration);
      } catch (error) {
        console.warn('[Twitter] Failed to get duration from manifest:', error);
      }
    }
    
    // Try to fetch user avatar
    let avatarUrl: string | undefined;
    if (username) {
      const cleanUsername = username.replace('@', '');
      console.log('[Twitter] Fetching avatar for username:', cleanUsername);
      avatarUrl = await getTwitterUserAvatar(cleanUsername);
      console.log('[Twitter] Avatar URL:', avatarUrl);
    }
    
    console.log('[Twitter] Parsed metadata:', {
      title: metadata.title || metadata.fulltitle,
      duration,
      thumbnail,
      uploader,
      username,
      avatarUrl,
    });
    
    return {
      title: metadata.title || metadata.fulltitle,
      duration,
      thumbnail,
      uploader,
      username,
      description: metadata.description,
      avatarUrl,
    };
  } catch (error) {
    console.error('[Twitter] Failed to get broadcast info:', error);
    return {};
  }
}
