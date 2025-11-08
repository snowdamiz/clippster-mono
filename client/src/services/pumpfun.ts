import { invoke } from '@tauri-apps/api/core';

/**
 * Extract mint ID from a PumpFun URL or return the input if it's already a mint ID
 * Supports various PumpFun URL formats:
 * - https://pump.fun/coin/9ezFthWrDUpSSeMdpLW6SDD9TJigHdc4AuQ5QN5bpump
 * - https://pump.fun/coin/9ezFthWrDUpSSeMdpLW6SDD9TJigHdc4AuQ5QN5bpump?clip=20251027_003639%3A1430550_20251027_003524
 * - https://pump.fun/base/xyz...
 * @param input - Either a mint ID string or a PumpFun URL
 * @returns The extracted mint ID or null if invalid
 */
export function extractMintId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // If it looks like a mint ID already (base58-like string), return as-is
  // Mint IDs are typically 43-44 characters and contain specific characters
  if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(trimmed)) {
    return trimmed;
  }

  // Try to parse as URL and extract mint ID
  try {
    const url = new URL(trimmed);

    // Check if it's a pump.fun domain
    if (!url.hostname.includes('pump.fun')) {
      return null;
    }

    // Extract path segments and look for mint ID
    const pathSegments = url.pathname.split('/').filter((segment) => segment.length > 0);

    // Look for patterns like /coin/{mintId} or /base/{mintId}
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      const nextSegment = pathSegments[i + 1];

      // Check if this segment indicates a mint ID follows
      if (segment === 'coin' || segment === 'base' || segment === 'mint') {
        const potentialMintId = nextSegment;
        if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(potentialMintId)) {
          return potentialMintId;
        }
      }
    }

    // If no explicit segment found, look for mint-like strings in the path
    for (const segment of pathSegments) {
      if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(segment)) {
        return segment;
      }
    }

    return null;
  } catch {
    // Invalid URL, check if it might be a mint ID that doesn't match the pattern
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed) ? trimmed : null;
  }
}

export interface PumpFunClip {
  clipId: string;
  sessionId?: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  playlistUrl?: string;
  mp4Url?: string;
  clipType: 'COMPLETE' | 'HIGHLIGHT';
  startTime?: string;
  endTime?: string;
  createdAt?: string;
}

export interface PumpFunClipsResponse {
  success: boolean;
  clips: PumpFunClip[];
  hasMore: boolean;
  total: number;
  error?: string;
}

/**
 * Fetch PumpFun clips for a given mint ID
 * @param mintId - The SPL mint ID
 * @param limit - Maximum number of clips to fetch (default: 20)
 * @returns Promise resolving to clips response
 */
export async function getPumpFunClips(
  mintId: string,
  limit: number = 20
): Promise<PumpFunClipsResponse> {
  try {
    const result = await invoke<string>('get_pumpfun_clips', {
      mintId,
      limit,
    });

    // Check if result is valid and not empty
    if (!result || result.trim() === '') {
      return {
        success: false,
        clips: [],
        hasMore: false,
        total: 0,
        error: 'Empty response from server',
      };
    }

    // Try to parse JSON with better error handling
    let parsed: PumpFunClipsResponse;
    try {
      console.log('[PumpFun] Raw result from Tauri:', result);
      parsed = JSON.parse(result);
      console.log('[PumpFun] Parsed response:', parsed);
    } catch (parseError) {
      console.error('[PumpFun] Failed to parse JSON response:', result);
      console.error('[PumpFun] Parse error:', parseError);
      return {
        success: false,
        clips: [],
        hasMore: false,
        total: 0,
        error: 'Invalid JSON response from server',
      };
    }

    return parsed;
  } catch (error) {
    console.error('[PumpFun] Tauri invoke error:', error);

    // Try to parse error message if it's JSON
    if (typeof error === 'string') {
      try {
        return JSON.parse(error);
      } catch {
        // Not JSON, return generic error
      }
    }

    const errorResponse = {
      success: false,
      clips: [],
      hasMore: false,
      total: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch clips',
    };
    console.error('[PumpFun] Returning error response:', errorResponse);
    return errorResponse;
  }
}

/**
 * Format duration in seconds to readable string (e.g., "1h 23m 45s")
 */
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

/**
 * Format date string to relative time (e.g., "2 hours ago")
 */
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
