import type { MediaPlatform } from '@clippster/shared-types';

export interface MobilePlatformConfig {
  id: MediaPlatform;
  name: string;
  provider: string;
  searchPlaceholder: string;
  supportsChannelBrowse: boolean;
}

export const MOBILE_PLATFORMS: MobilePlatformConfig[] = [
  {
    id: 'tokend',
    name: 'Tokend',
    provider: 'tokend',
    searchPlaceholder: 'Tokend URL or @handle',
    supportsChannelBrowse: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    provider: 'youtube',
    searchPlaceholder: 'Paste video URL or channel @handle',
    supportsChannelBrowse: true,
  },
  {
    id: 'kick',
    name: 'Kick',
    provider: 'kick',
    searchPlaceholder: 'Channel slug or Kick URL',
    supportsChannelBrowse: true,
  },
  {
    id: 'twitch',
    name: 'Twitch',
    provider: 'twitch',
    searchPlaceholder: 'Channel name or Twitch URL',
    supportsChannelBrowse: true,
  },
  {
    id: 'rumble',
    name: 'Rumble',
    provider: 'rumble',
    searchPlaceholder: 'Channel or Rumble URL',
    supportsChannelBrowse: true,
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    provider: 'twitter',
    searchPlaceholder: 'Paste post, broadcast, or Space URL',
    supportsChannelBrowse: false,
  },
];

export function getPlatformConfig(id: string): MobilePlatformConfig | undefined {
  return MOBILE_PLATFORMS.find((platform) => platform.id === id);
}

export function detectPlatformFromUrl(url: string): MediaPlatform | null {
  if (/tokend\.tv/i.test(url) || /localhost:4100/i.test(url)) return 'tokend';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/kick\.com/i.test(url)) return 'kick';
  if (/twitch\.tv/i.test(url)) return 'twitch';
  if (/rumble\.com/i.test(url)) return 'rumble';
  if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
  return null;
}
