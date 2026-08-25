export type PlatformId = 'pumpfun' | 'kick' | 'twitch' | 'YouTube' | 'rumble' | 'twitter';

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
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    description: 'Download videos from X/Twitter posts, broadcasts, and spaces',
    icon: '/x.svg',
    searchPlaceholder: 'Paste X post, broadcast, or space URL',
    searchLabel: 'Video URL',
    emptyStateTitle: 'Enter X Video URL',
    emptyStateDescription:
      'Paste a timeline video post URL, broadcast replay, or Space URL to download.',
    isComingSoon: false,
    provider: 'twitter',
    localStorageKey: 'twitter_recent_searches',
  },
  rumble: {
    id: 'rumble',
    name: 'Rumble',
    description: 'Download VODs directly from Rumble',
    icon: '/rumble.svg',
    searchPlaceholder: 'Channel name or Rumble URL',
    searchLabel: 'Channel',
    emptyStateTitle: 'Search for VODs',
    emptyStateDescription: 'Paste a Rumble channel URL or name to find VODs.',
    isComingSoon: false,
    provider: 'rumble',
    localStorageKey: 'rumble_recent_searches',
  },
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
    isComingSoon: false,
    provider: 'twitch',
    localStorageKey: 'twitch_recent_searches',
  },
  YouTube: {
    id: 'YouTube',
    name: 'YouTube',
    description: 'Download videos directly from YouTube',
    icon: '/youtube.svg',
    searchPlaceholder: 'Channel URL or @handle',
    searchLabel: 'Channel',
    emptyStateTitle: 'Search for VODs',
    emptyStateDescription: 'Paste a YouTube channel URL or @handle to find VODs.',
    isComingSoon: false,
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
