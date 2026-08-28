import { File, FileMode } from 'expo-file-system';
import type { VideoSource } from 'expo-video';
import { moovIsBeforeMdat } from '@/lib/mp4Boxes';

export function toPlaybackUri(path: string): string {
  if (
    path.startsWith('file://') ||
    path.startsWith('content://') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  return `file://${path}`;
}

/** Local VOD files are progressive MP4s — never let the player sniff them as HLS. */
export function toVideoSource(path: string): VideoSource {
  return { uri: toPlaybackUri(path), contentType: 'progressive' };
}

export async function isFaststartMp4(path: string): Promise<boolean> {
  const uri = toPlaybackUri(path);
  if (!/\.mp4$/i.test(uri.split('?')[0] ?? uri)) return false;

  const file = new File(uri);
  if (!file.exists) return false;

  const handle = file.open(FileMode.ReadOnly);
  try {
    return moovIsBeforeMdat(handle.readBytes(128 * 1024));
  } catch {
    return false;
  } finally {
    handle.close();
  }
}
