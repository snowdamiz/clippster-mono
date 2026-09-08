import type { VodListItem } from '@clippster/shared-types';
import type { KickClip } from '@clippster/api-client';

/**
 * Extract channel slug from a Kick URL or bare username — mirrors desktop kick.ts.
 */
export function extractKickChannelSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('kick.com')) return null;
      const parts = url.pathname.split('/').filter((p) => p.length > 0);
      if (parts.length === 0 || parts[0] === 'video') return null;
      return parts[0];
    } catch {
      return null;
    }
  }

  if (/^[a-zA-Z0-9_-]{3,}$/.test(trimmed)) {
    return trimmed.replace(/^@/, '');
  }

  return null;
}

export function kickClipToVodItem(clip: KickClip, channelSlug?: string): VodListItem {
  const pageUrl =
    clip.pageUrl ||
    (clip.playlistUrl?.includes('kick.com') && clip.playlistUrl.includes('/videos/')
      ? clip.playlistUrl
      : null);

  const playlistUrl = clip.playlistUrl ?? null;
  const mp4Url = clip.mp4Url ?? null;
  const streamUrl = mp4Url || playlistUrl;

  const streamedAt = clip.createdAt ?? clip.startTime ?? null;

  return {
    id: clip.clipId,
    title: clip.title,
    duration_seconds: clip.duration > 0 ? clip.duration : null,
    thumbnail_url: clip.thumbnailUrl ?? null,
    url: pageUrl || playlistUrl || null,
    download_url: streamUrl || pageUrl || null,
    upload_date: streamedAt,
    uploader: channelSlug ?? null,
    views: clip.views ?? null,
  };
}

