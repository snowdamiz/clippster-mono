import type { MediaPlatform } from '@clippster/shared-types';
import { extractTokendChannel } from '@/services/tokendUrl';

/** UI + search platform detection — mirrors desktop StreamVods.vue heuristics. */
export function detectPlatformFromInput(input: string): MediaPlatform | null {
  const val = input.trim();
  if (!val) return null;

  const lowerVal = val.toLowerCase();

  if (lowerVal.includes('youtube.com') || lowerVal.includes('youtu.be')) return 'youtube';
  if (lowerVal.includes('twitch.tv')) return 'twitch';
  if (lowerVal.includes('kick.com')) return 'kick';
  if (lowerVal.includes('rumble.com')) return 'rumble';
  if (
    lowerVal.includes('tokend.tv') ||
    lowerVal.includes('localhost:4100') ||
    lowerVal.includes('127.0.0.1:4100')
  ) {
    return 'tokend';
  }
  if (
    (lowerVal.includes('twitter.com') || lowerVal.includes('x.com')) &&
    (lowerVal.includes('/i/broadcasts/') ||
      lowerVal.includes('/i/spaces/') ||
      /\/status(?:es)?\/\d+/i.test(lowerVal))
  ) {
    return 'twitter';
  }

  if (extractTokendChannel(val)) return 'tokend';

  // Bare handle fallback (Kick username, YouTube @handle, etc.)
  if (/^@?[a-zA-Z0-9_-]{3,}$/.test(val)) return 'kick';

  return null;
}

export function isDirectVideoUrl(platform: MediaPlatform, input: string): boolean {
  const val = input.trim().toLowerCase();

  switch (platform) {
    case 'youtube':
      return /(?:v=|youtu\.be\/|\/shorts\/|\/live\/)/.test(val);
    case 'kick':
      return (
        /kick\.com\/[^/]+\/videos?\//.test(val) ||
        /kick\.com\/video\//.test(val)
      );
    case 'twitch':
      return /twitch\.tv\/videos\//.test(val) || /\/clip\//.test(val);
    case 'rumble':
      return /rumble\.com\/v[a-z0-9]+/i.test(val);
    case 'twitter':
      return true;
    case 'tokend':
      return false;
    default:
      return false;
  }
}

export const PLATFORM_LABELS: Record<MediaPlatform, string> = {
  youtube: 'YouTube',
  kick: 'Kick',
  twitch: 'Twitch',
  rumble: 'Rumble',
  twitter: 'X',
  tokend: 'Tokend',
  manual: 'Local file',
};
