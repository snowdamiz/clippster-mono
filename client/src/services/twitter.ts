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
 * Stop recording a Twitter broadcast or Space (stops ALL sessions for this broadcast)
 */
export async function stopTwitterRecording(url: string): Promise<void> {
  await invoke('stop_twitter_recording', { url });
}

/**
 * Stop a specific Twitter recording session by session_id
 * Unlike stopTwitterRecording which stops ALL sessions for a broadcast,
 * this only stops the one specific session, leaving others untouched.
 */
export async function stopTwitterRecordingSession(sessionId: string): Promise<void> {
  await invoke('stop_twitter_recording_session', { sessionId });
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
 * Twitter live status response
 */
export interface TwitterLiveStatus {
  isLive: boolean;
  displayName?: string;
  profileImageUrl?: string;
  viewerCount?: number;
  startedAt?: string;
  title?: string;
}

/**
 * Check if a Twitter broadcast/space is currently live
 */
export async function checkTwitterLivestream(urlOrUsername: string): Promise<TwitterLiveStatus> {
  try {
    // If it's a broadcast/space URL, check if we can fetch metadata
    if (urlOrUsername.includes('/i/broadcasts/') || urlOrUsername.includes('/i/spaces/')) {
      const metadata = await getTwitterBroadcastInfo(urlOrUsername);
      
      // If we got metadata, the broadcast is accessible (likely live or recently ended)
      // Twitter broadcasts that have ended are typically removed quickly
      const isLive = !!(metadata.title || metadata.duration);
      
      return {
        isLive,
        displayName: metadata.username || metadata.uploader,
        profileImageUrl: metadata.avatarUrl || metadata.thumbnail,
        title: metadata.title,
      };
    }
    
    // For username-only tracking, we can't determine live status without a broadcast URL
    // Return offline status
    return {
      isLive: false,
      displayName: urlOrUsername.replace('@', ''),
    };
  } catch (error) {
    console.warn('[Twitter] Failed to check live status:', error);
    return {
      isLive: false,
    };
  }
}

/**
 * Get metadata for a Twitter broadcast/space
 */
/** CamelCase from Rust `serde(rename_all = "camelCase")` */
export interface SpaceHlsSpeakerSegmentInvoke {
  id: string;
  speakerId: string;
  start: number;
  end: number;
}

export interface SpaceHlsStageSnapshotInvoke {
  id: string;
  t: number;
  onStageUserIds: string[];
}

export interface SpaceHlsMetadataInvokeResult {
  speakerSegments: SpaceHlsSpeakerSegmentInvoke[];
  stageSnapshots: SpaceHlsStageSnapshotInvoke[];
}

/** HLS replay manifest (m3u8) — used to extract ID3 speaker timeline; not the Space page URL. */
export async function extractSpaceSpeakerTimelineFromHls(
  manifestUrl: string,
  durationSecs?: number
): Promise<SpaceHlsMetadataInvokeResult> {
  return invoke('extract_space_speaker_timeline_from_hls_manifest', {
    manifestUrl,
    durationSecs: durationSecs ?? null,
  });
}

/** A speaker segment derived from the X API (Periscope or stage-join data). */
export interface SpaceSpeakerTimelineSegment {
  id: string;
  speakerId: string;
  start: number;
  end: number;
}

// Cache broadcast info by normalized URL so the post-download metadata enrichment
// call reuses the result fetched during the pre-download search, avoiding a second
// yt-dlp + GraphQL round-trip that often fails once the guest token has gone stale.
const _broadcastInfoCache = new Map<string, Awaited<ReturnType<typeof getTwitterBroadcastInfo>>>();

export async function getTwitterBroadcastInfo(url: string): Promise<{
  title?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  username?: string;
  /** Direct HLS playlist URL from yt-dlp (replay speaker timeline). */
  manifestUrl?: string;
  participants?: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    role?: 'host' | 'speaker' | 'guest' | 'unknown';
  }>;
  /**
   * Speaker timeline built from X API data (Periscope typing_active events or
   * stage-join timestamps from AudioSpaceById).  More accurate than HLS ID3 parsing.
   */
  speakerTimeline?: SpaceSpeakerTimelineSegment[];
  mediaKey?: string;
  description?: string;
  avatarUrl?: string;
  timestamp?: string;
  uploadDate?: string;
  error?: string;
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
    
    // Try to get duration from ffprobe first (most reliable)
    let duration: number | undefined;
    if (metadata.manifest_url || metadata.url) {
      const probeUrl = metadata.manifest_url || metadata.url;
      try {
        console.log('[Twitter] Fetching duration via ffprobe from:', probeUrl);
        duration = await invoke<number>('get_twitter_broadcast_duration', { 
          manifestUrl: probeUrl 
        });
        console.log('[Twitter] Duration from ffprobe:', duration);
      } catch (error) {
        console.warn('[Twitter] Failed to get duration from ffprobe:', error);
        
        // Fallback to yt-dlp metadata if ffprobe fails
        let metaDuration = metadata.duration;
        if (typeof metaDuration === 'string') {
          metaDuration = parseFloat(metaDuration);
        }
        if (!isNaN(metaDuration) && metaDuration !== null && metaDuration !== undefined) {
          duration = metaDuration;
          console.log('[Twitter] Using duration from yt-dlp metadata:', duration);
        }
      }
    } else {
      // No URL available, try yt-dlp metadata
      let metaDuration = metadata.duration;
      if (typeof metaDuration === 'string') {
        metaDuration = parseFloat(metaDuration);
      }
      if (!isNaN(metaDuration) && metaDuration !== null && metaDuration !== undefined) {
        duration = metaDuration;
        console.log('[Twitter] Using duration from yt-dlp metadata (no URL):', duration);
      }
    }
    
    // Extract timestamp from yt-dlp metadata
    let timestamp: string | undefined;
    let uploadDate: string | undefined;
    
    // Try timestamp field (Unix timestamp)
    if (metadata.timestamp) {
      try {
        const date = new Date(metadata.timestamp * 1000);
        timestamp = date.toISOString();
        console.log('[Twitter] Timestamp from metadata.timestamp:', timestamp);
      } catch (error) {
        console.warn('[Twitter] Failed to parse timestamp:', error);
      }
    }
    
    // Try release_timestamp as fallback
    if (!timestamp && metadata.release_timestamp) {
      try {
        const date = new Date(metadata.release_timestamp * 1000);
        timestamp = date.toISOString();
        console.log('[Twitter] Timestamp from metadata.release_timestamp:', timestamp);
      } catch (error) {
        console.warn('[Twitter] Failed to parse release_timestamp:', error);
      }
    }
    
    // Try upload_date field (YYYYMMDD format)
    if (metadata.upload_date) {
      uploadDate = metadata.upload_date;
      // Convert YYYYMMDD to ISO string if we don't have timestamp
      if (!timestamp && uploadDate) {
        try {
          const year = uploadDate.substring(0, 4);
          const month = uploadDate.substring(4, 6);
          const day = uploadDate.substring(6, 8);
          timestamp = new Date(`${year}-${month}-${day}`).toISOString();
          console.log('[Twitter] Timestamp from metadata.upload_date:', timestamp);
        } catch (error) {
          console.warn('[Twitter] Failed to parse upload_date:', error);
        }
      }
    }
    
    // Try modified_date as last resort
    if (!timestamp && metadata.modified_date) {
      try {
        const year = metadata.modified_date.substring(0, 4);
        const month = metadata.modified_date.substring(4, 6);
        const day = metadata.modified_date.substring(6, 8);
        timestamp = new Date(`${year}-${month}-${day}`).toISOString();
        console.log('[Twitter] Timestamp from metadata.modified_date:', timestamp);
      } catch (error) {
        console.warn('[Twitter] Failed to parse modified_date:', error);
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
      timestamp,
      uploadDate,
    });
    
    const participants = extractParticipantsFromTwitterMetadata(metadata, avatarUrl);

    const manifestUrl: string | undefined =
      typeof metadata.manifest_url === 'string' && metadata.manifest_url.length > 0
        ? metadata.manifest_url
        : typeof metadata.url === 'string' && metadata.url.includes('.m3u8')
          ? metadata.url
          : undefined;

    // Speaker timeline from X API (injected by Rust into metadata JSON)
    let speakerTimeline: SpaceSpeakerTimelineSegment[] | undefined =
      Array.isArray(metadata.speakerTimeline) && metadata.speakerTimeline.length > 0
        ? (metadata.speakerTimeline as SpaceSpeakerTimelineSegment[])
        : undefined;

    if (speakerTimeline) {
      console.log(`[Twitter] speakerTimeline from X API: ${speakerTimeline.length} segments`);
    } else if (participants && participants.length > 0 && duration && duration > 0) {
      // Rust GraphQL/Periscope call didn't produce a timeline — build an
      // equal-distribution fallback from the participants we already have.
      const onStage = participants.filter(p => p.role !== 'listener');
      if (onStage.length > 0) {
        const segDur = duration / onStage.length;
        speakerTimeline = onStage.map((p, i) => ({
          id: `eq-${i}`,
          speakerId: p.id,
          start: i * segDur,
          end: Math.min((i + 1) * segDur, duration),
        }));
        console.log(`[Twitter] Built equal-distribution fallback speakerTimeline: ${speakerTimeline.length} segments`);
      }
    }

    const broadcastResult = {
      title: metadata.title || metadata.fulltitle,
      duration,
      thumbnail,
      uploader,
      username,
      manifestUrl,
      participants,
      speakerTimeline,
      mediaKey: typeof metadata.mediaKey === 'string' ? metadata.mediaKey : undefined,
      description: metadata.description,
      avatarUrl,
      timestamp,
      uploadDate,
    };
    _broadcastInfoCache.set(cacheKey, broadcastResult);
    return broadcastResult;
  } catch (error) {
    console.error('[Twitter] Failed to get broadcast info:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return minimal data with error flag so UI can still show the VOD
    // Extract broadcast ID from URL for fallback title
    const broadcastId = extractTwitterBroadcastId(url);
    return {
      title: broadcastId ? `X Broadcast ${broadcastId.substring(0, 8)}...` : 'X Broadcast',
      error: errorMessage,
    };
  }
}

function extractParticipantsFromTwitterMetadata(
  metadata: any,
  hostAvatarUrl?: string
): Array<{ id: string; name: string; avatarUrl?: string; role?: 'host' | 'speaker' | 'guest' | 'unknown' }> {
  const participants: Array<{ id: string; name: string; avatarUrl?: string; role?: 'host' | 'speaker' | 'guest' | 'unknown' }> = [];
  const seen = new Set<string>();

  const pushParticipant = (
    rawId: string | undefined,
    rawName: string | undefined,
    role: 'host' | 'speaker' | 'guest' | 'unknown',
    avatarUrl?: string
  ) => {
    const name = (rawName || rawId || '').trim();
    if (!name) return;
    const id = (rawId || name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!id || seen.has(id)) return;
    seen.add(id);
    participants.push({ id, name, avatarUrl, role });
  };

  const hostName =
    metadata?.uploader ||
    metadata?.channel ||
    metadata?.uploader_id ||
    metadata?.creator;
  const hostId = metadata?.uploader_id || hostName;

  // Spaces: backend merges AudioSpace GraphQL roster into `participants` (includes hosts in `admins`).
  // Do not prepend yt-dlp uploader separately — IDs differ (screen name vs rest_id) and would duplicate.
  const hasStructuredRoster =
    Array.isArray(metadata?.participants) && metadata.participants.length > 0;
  if (!hasStructuredRoster) {
    pushParticipant(hostId, hostName, 'host', hostAvatarUrl);
  }

  const candidateArrays = [
    metadata?.participants,
    metadata?.speakers,
    metadata?.speaker_ids,
    metadata?.speaker_names,
    metadata?.hosts,
    metadata?.host_ids,
    metadata?.guest_list,
    metadata?.guests,
  ].filter(Boolean);

  for (const candidate of candidateArrays) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      if (typeof item === 'string') {
        pushParticipant(item, item, 'speaker');
        continue;
      }
      if (item && typeof item === 'object') {
        pushParticipant(
          item.id || item.user_id || item.username || item.handle,
          item.name || item.display_name || item.username || item.handle,
          (item.role as 'host' | 'speaker' | 'guest' | 'unknown') || 'speaker',
          item.avatar_url || item.profile_image_url || item.profile_image || item.avatar
        );
      }
    }
  }

  // yt-dlp always encodes the stage roster in this sentence even when GraphQL JSON is sparse for replays.
  const descriptionNames = parseTwitterSpaceParticipatedByNames(metadata?.description);
  for (const name of descriptionNames) {
    pushParticipant(undefined, name, 'speaker');
  }

  // Host is often omitted from the "participated by" line but should still appear in the grid.
  const isSpace =
    metadata?.extractor === 'twitter:spaces' ||
    metadata?.extractor_key === 'TwitterSpaces';
  if (isSpace && hostName) {
    const uname = String(metadata?.uploader_id ?? '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '');
    const hostLabel = String(hostName).trim().replace(/^@/, '').toLowerCase();
    const hasHost = participants.some((p) => {
      const pname = p.name.replace(/^@/, '').trim().toLowerCase();
      const pid = p.id.toLowerCase();
      return (
        (uname.length > 0 && (pid === uname || pname === uname)) ||
        (hostLabel.length > 0 && pname === hostLabel)
      );
    });
    if (!hasHost) {
      pushParticipant(hostId, hostName, 'host', hostAvatarUrl);
    }
  }

  return participants;
}

/** Names after "Twitter Space participated by …" from yt-dlp / X replay metadata. */
function parseTwitterSpaceParticipatedByNames(description: unknown): string[] {
  if (typeof description !== 'string' || description.length === 0) return [];
  const m = description.match(/Twitter Space participated by\s+(.+)/i);
  if (!m?.[1]) return [];
  const body = m[1].trim();
  if (!body || /^nobody yet$/i.test(body)) return [];
  return body
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
