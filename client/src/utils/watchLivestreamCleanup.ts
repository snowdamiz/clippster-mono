import { invoke } from '@tauri-apps/api/core';

/**
 * Watch / Auto-DVR session IDs use platform-prefixed names.
 * Record / auto-detect sessions use UUID ids and must NOT be deleted on stream end —
 * those folders are the project's raw video sources until the project is deleted.
 */
const WATCH_LIVESTREAM_SESSION_PREFIXES = [
  'kick-view-',
  'kick-dvr-',
  'twitch-view-',
  'twitch-dvr-',
  'youtube-view-',
  'youtube-dvr-',
  'rumble-view-',
  'rumble-dvr-',
  'twitter-view-',
  'twitter-dvr-',
] as const;

export function isWatchLivestreamSessionId(sessionId: string): boolean {
  return WATCH_LIVESTREAM_SESSION_PREFIXES.some((prefix) => sessionId.startsWith(prefix));
}

/**
 * Delete on-disk HLS segments for a watch/temp DVR session only.
 * No-ops for record/auto-detect UUID session ids.
 */
export async function deleteWatchLivestreamRecording(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId || !isWatchLivestreamSessionId(sessionId)) {
    return;
  }

  try {
    await invoke('delete_livestream_recording', { sessionId });
    console.log('[WatchCleanup] Deleted watch livestream recording:', sessionId);
  } catch (error) {
    console.warn('[WatchCleanup] Failed to delete watch livestream recording:', sessionId, error);
  }
}

/**
 * Sweep leftover watch/temp DVR folders (orphans from prior sessions / crashes).
 * Never touches UUID record/auto-detect session directories.
 */
export async function cleanupOrphanedWatchLivestreamRecordings(): Promise<number> {
  try {
    const deleted = await invoke<number>('cleanup_watch_livestream_recordings');
    if (deleted > 0) {
      console.log(`[WatchCleanup] Removed ${deleted} orphaned watch livestream recording folder(s)`);
    }
    return deleted;
  } catch (error) {
    console.warn('[WatchCleanup] Failed orphaned watch recording sweep:', error);
    return 0;
  }
}
