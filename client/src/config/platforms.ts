export type PlatformId = 'pumpfun' | 'kick' | 'twitch' | 'youtube';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  description: string;
  icon: string; // SVG file path
  searchPlaceholder: string;
  searchLabel: string; // e.g., "Mint ID" or "Channel Slug"
  emptyStateTitle: string;
  emptyStateDescription: string;
  filterMinDuration?: number; // Minimum duration in seconds (e.g., 180 for PumpFun)
  showFilterNotice?: boolean;
  filterNoticeText?: string;
  isComingSoon: boolean;
  comingSoonMessage?: string;
  provider: string; // For download service
  localStorageKey: string; // For recent searches
}

export const platformConfigs: Record<PlatformId, PlatformConfig> = {
  pumpfun: {
    id: 'pumpfun',
    name: 'PumpFun',
    description: 'Download streams directly from PumpFun',
    icon: '/capsule.svg',
    searchPlaceholder: 'Mint ID or PumpFun URL',
    searchLabel: 'Mint ID',
    emptyStateTitle: 'Search for VODs',
    emptyStateDescription: 'Search for VODs by Mint ID or PumpFun URL.',
    filterMinDuration: 180, // 3 minutes
    showFilterNotice: true,
    filterNoticeText:
      'Showing videos 3 minutes and longer. Shorter videos have been filtered out for better quality.',
    isComingSoon: false,
    provider: 'pumpfun',
    localStorageKey: 'pumpfun_recent_searches',
  },
  kick: {
    id: 'kick',
    name: 'Kick',
    description: 'Download VODs directly from Kick',
    icon: '/kick.svg',
    searchPlaceholder: 'Channel Slug or Kick URL',
    searchLabel: 'Channel',
    emptyStateTitle: 'Search for VODs',
    emptyStateDescription: 'Search for VODs by Channel Slug or Kick URL.',
    isComingSoon: false,
    provider: 'kick',
    localStorageKey: 'kick_recent_searches',
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    description: 'Download VODs directly from Twitch',
    icon: '/twitch.svg',
    searchPlaceholder: 'Channel name or Twitch URL',
    searchLabel: 'Channel',
    emptyStateTitle: 'Search for VODs',
    emptyStateDescription: 'Search for VODs by channel name or Twitch URL.',
    isComingSoon: true,
    comingSoonMessage:
      "We're working hard to bring Twitch streaming content management to Clippster. This feature will allow you to import, organize, and create clips from your Twitch streams and VODs.",
    provider: 'twitch',
    localStorageKey: 'twitch_recent_searches',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    description: 'Download videos directly from YouTube',
    icon: '/youtube.svg',
    searchPlaceholder: 'Video URL or Channel URL',
    searchLabel: 'URL',
    emptyStateTitle: 'Search for Videos',
    emptyStateDescription: 'Search for videos by URL or channel.',
    isComingSoon: true,
    comingSoonMessage:
      "We're working hard to bring YouTube video content management to Clippster. This feature will allow you to import, organize, and create clips from your YouTube videos and streams.",
    provider: 'youtube',
    localStorageKey: 'youtube_recent_searches',
  },
};

export function getPlatformConfig(platformId: string): PlatformConfig | null {
  return platformConfigs[platformId as PlatformId] || null;
}

export function isValidPlatform(platformId: string): platformId is PlatformId {
  return platformId in platformConfigs;
}
