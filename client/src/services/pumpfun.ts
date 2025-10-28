import { invoke } from '@tauri-apps/api/core'

export interface PumpFunClip {
  clipId: string
  sessionId?: string
  title: string
  duration: number
  thumbnailUrl?: string
  playlistUrl?: string
  mp4Url?: string
  clipType: 'COMPLETE' | 'HIGHLIGHT'
  startTime?: string
  endTime?: string
  createdAt?: string
}

export interface PumpFunClipsResponse {
  success: boolean
  clips: PumpFunClip[]
  hasMore: boolean
  total: number
  error?: string
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
      limit
    })

    const parsed: PumpFunClipsResponse = JSON.parse(result)
    return parsed
  } catch (error) {
    console.error('Failed to fetch PumpFun clips:', error)
    
    // Try to parse error message if it's JSON
    if (typeof error === 'string') {
      try {
        return JSON.parse(error)
      } catch {
        // Not JSON, return generic error
      }
    }
    
    return {
      success: false,
      clips: [],
      hasMore: false,
      total: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch clips'
    }
  }
}

/**
 * Format duration in seconds to readable string (e.g., "1h 23m 45s")
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0s'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  const parts: string[] = []
  
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
  
  return parts.join(' ')
}

/**
 * Format date string to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Unknown'
  
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    return 'Just now'
  } catch {
    return 'Unknown'
  }
}
