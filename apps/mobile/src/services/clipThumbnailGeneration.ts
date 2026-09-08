import * as FileSystem from 'expo-file-system/legacy';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { getExpoImage } from '@/lib/expoImage';
import { withThumbnailDecodeSlot } from '@/lib/mediaDecodeGate';
import { extractThumbnail } from '@/services/ffmpeg';

export const CLIP_THUMB_DIR = `${FileSystem.documentDirectory}thumbnails/`;

async function ensureThumbDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(CLIP_THUMB_DIR, { intermediates: true });
}

function clipThumbPath(clipId: string): string {
  return `${CLIP_THUMB_DIR}clip_${clipId}.jpg`;
}

function buildThumbPath(buildId: string): string {
  return `${CLIP_THUMB_DIR}build_${buildId}.jpg`;
}

async function saveNativeThumbnail(thumbnail: VideoThumbnail, destPath: string): Promise<string | null> {
  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
    const rendered = await ImageManipulator.manipulate(thumbnail).renderAsync();
    const saved = await rendered.saveAsync({
      compress: 0.85,
      format: SaveFormat.JPEG,
    });
    if (saved.uri === destPath) return destPath;
    await FileSystem.copyAsync({ from: saved.uri, to: destPath });
    return destPath;
  } catch (error) {
    console.warn('[ClipThumbnail] native save failed', error);
    return null;
  }
}

/**
 * Extract a JPEG thumbnail from a local video into `destPath`.
 * FFmpeg when decode is available; otherwise expo-video + save JPEG to disk.
 */
export async function generateVideoThumbnailFile(
  videoPath: string,
  destPath: string,
  timestampSeconds: number,
): Promise<string | null> {
  return withThumbnailDecodeSlot(async () => {
    await ensureThumbDir();

    try {
      await extractThumbnail(videoPath, destPath, timestampSeconds);
      if ((await FileSystem.getInfoAsync(destPath)).exists) return destPath;
    } catch {
      // remux-only FFmpeg stub — fall through to expo-video
    }

    if (!getExpoImage()) return null;

    let player: ReturnType<typeof createVideoPlayer> | null = null;
    try {
      player = createVideoPlayer(videoPath);
      if (typeof player.generateThumbnailsAsync !== 'function') return null;
      const thumbs = await player.generateThumbnailsAsync([Math.max(0, timestampSeconds)], {
        maxHeight: 320,
      });
      const native = thumbs[0];
      if (!native) return null;
      return await saveNativeThumbnail(native, destPath);
    } catch (error) {
      console.warn('[ClipThumbnail] generate failed', error);
      return null;
    } finally {
      player?.release();
    }
  });
}

/**
 * Desktop parity: `generate_thumbnail_at_timestamp` during clip detection.
 */
export async function generateClipThumbnailAtTimestamp(
  videoPath: string,
  timestampSeconds: number,
  clipId: string,
): Promise<string | null> {
  await ensureThumbDir();
  return generateVideoThumbnailFile(videoPath, clipThumbPath(clipId), timestampSeconds);
}

/** Thumbnail for a completed clip build / export file. */
export async function generateBuildThumbnail(
  videoPath: string,
  buildId: string,
  timestampSeconds = 1,
): Promise<string | null> {
  await ensureThumbDir();
  return generateVideoThumbnailFile(videoPath, buildThumbPath(buildId), timestampSeconds);
}

export interface ClipThumbnailTarget {
  id: string;
  start_time: number | null;
  end_time: number | null;
  built_thumbnail_path?: string | null;
}

/** One clip at a time — same as desktop ClipsTab.generateMissingThumbnails. */
export async function generateMissingClipThumbnails(
  videoPath: string,
  clips: ClipThumbnailTarget[],
  onSaved: (clipId: string, thumbnailPath: string) => Promise<void>,
): Promise<number> {
  let saved = 0;
  for (const clip of clips) {
    if (clip.built_thumbnail_path) continue;
    const start = clip.start_time ?? 0;
    const end = clip.end_time ?? start;
    const midpoint = start + (end - start) / 2;
    const path = await generateClipThumbnailAtTimestamp(videoPath, midpoint, clip.id);
    if (!path) continue;
    await onSaved(clip.id, path);
    saved += 1;
  }
  return saved;
}
