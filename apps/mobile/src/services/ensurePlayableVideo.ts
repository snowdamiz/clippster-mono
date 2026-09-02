import { File } from 'expo-file-system';
import { isFaststartMp4, toPlaybackUri } from '@/lib/playbackVideo';
import { isFfmpegAvailable, remuxToMp4 } from '@/services/ffmpeg';

const triedThisSession = new Set<string>();

function playableSiblingPath(path: string): string {
  const uri = toPlaybackUri(path);
  if (uri.endsWith('.play.mp4')) return uri;
  return uri.replace(/\.[^./]+$/, '') + '.play.mp4';
}

/**
 * HLS downloads were byte-concatenated then stream-copied. Those MP4s freeze in
 * expo-video until remuxed with faststart + monotonic timestamps.
 */
export async function ensurePlayableVideo(path: string): Promise<string> {
  if (!path || path.startsWith('pending://') || path.startsWith('http')) return path;

  if (await isFaststartMp4(path)) return path;

  const playable = playableSiblingPath(path);
  if (playable !== toPlaybackUri(path) && (await isFaststartMp4(playable))) {
    return playable;
  }

  if (triedThisSession.has(path) || !(await isFfmpegAvailable())) return path;
  triedThisSession.add(path);

  try {
    const dest = new File(playable);
    if (dest.exists) dest.delete();
    await remuxToMp4(path, playable);
    if (await isFaststartMp4(playable)) return playable;
    console.warn('[Playback] remux finished but moov is still at the end — rebuild the Android dev client');
  } catch (error) {
    console.warn('[Playback] playable remux failed', error);
  }
  return path;
}
