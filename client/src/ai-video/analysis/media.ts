import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { MediaItem, MediaKind } from '../types';

const THUMBNAIL_SIZE = 320;
const thumbnails = new Map<string, Promise<string | null>>();

export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi'];
export const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'];
const MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...PHOTO_EXTENSIONS, ...AUDIO_EXTENSIONS];

export function fileExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? '';
}

interface InspectedMedia {
  kind: MediaKind;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  contentHash: string;
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

/** Native file dialog filtered to `extensions`; resolves to the chosen paths (empty when cancelled). */
export async function pickFiles(
  extensions: string[],
  multiple: boolean,
  name: string
): Promise<string[]> {
  const selected = await openDialog({ multiple, filters: [{ name, extensions }] });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

/** A file to add; library picks carry their display name. */
export interface MediaFile {
  path: string;
  name?: string;
}

function nextId(existing: MediaItem[]): () => string {
  let counter = existing.reduce(
    (max, item) => Math.max(max, Number(/^m(\d+)$/.exec(item.id)?.[1] ?? 0)),
    0
  );
  return () => `m${++counter}`;
}

/** Inspect added files into media items. Files already in the project (same content) are skipped. */
export async function importMediaFiles(
  files: MediaFile[],
  existing: MediaItem[]
): Promise<{ items: MediaItem[]; failed: Array<{ name: string; error: string }> }> {
  const id = nextId(existing);
  const seen = new Set(existing.map((item) => item.contentHash));
  const items: MediaItem[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  for (const { path, name = fileName(path) } of files) {
    if (!MEDIA_EXTENSIONS.includes(fileExtension(path))) {
      failed.push({ name, error: 'Not a video, photo or audio file.' });
      continue;
    }
    try {
      const inspected = await invoke<InspectedMedia>('inspect_ai_media', { path });
      if (seen.has(inspected.contentHash)) continue;
      seen.add(inspected.contentHash);
      items.push({ id: id(), name, path, ...inspected });
    } catch (error) {
      failed.push({ name, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { items, failed };
}

/** Small inline JPEG of any local image (the asset protocol can't read arbitrary paths). */
export function imageThumbnail(path: string): Promise<string> {
  return invoke<string>('encode_image_for_ai', { path, maxDimension: THUMBNAIL_SIZE }).then(
    (data) => `data:image/jpeg;base64,${data}`
  );
}

/**
 * Displayable thumbnail for a clip or photo, cached by content. Media can live anywhere on disk
 * (outside the asset protocol scope), so videos get a frame written to app storage and photos a
 * small inline JPEG.
 */
export function mediaThumbnail(
  item: Pick<MediaItem, 'kind' | 'path' | 'duration' | 'contentHash'>
): Promise<string | null> {
  if (item.kind === 'audio') return Promise.resolve(null);
  let thumbnail = thumbnails.get(item.contentHash);
  if (!thumbnail) {
    thumbnail = (
      item.kind === 'photo'
        ? imageThumbnail(item.path)
        : invoke<string>('generate_thumbnail_at_timestamp', {
            videoPath: item.path,
            timestampSeconds: Math.min(1, item.duration / 2),
            outputFilename: `ai-media-${item.contentHash}`,
          }).then((path) => convertFileSrc(path))
    ).catch(() => null);
    thumbnails.set(item.contentHash, thumbnail);
  }
  return thumbnail;
}
