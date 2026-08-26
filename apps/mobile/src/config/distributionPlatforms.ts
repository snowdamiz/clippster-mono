import type { SocialPlatform } from '@clippster/api-client';

export interface DistributionPlatformConfig {
  id: SocialPlatform;
  name: string;
  icon: 'logo-instagram' | 'logo-tiktok' | 'logo-twitter' | 'logo-youtube' | 'planet';
  preferredAspectRatio: '9:16' | '16:9' | 'any';
  provider: 'postforme' | 'tokend';
}

export const DISTRIBUTION_PLATFORMS: DistributionPlatformConfig[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'logo-instagram',
    preferredAspectRatio: '9:16',
    provider: 'postforme',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'logo-tiktok',
    preferredAspectRatio: '9:16',
    provider: 'postforme',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'logo-twitter',
    preferredAspectRatio: '16:9',
    provider: 'postforme',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'logo-youtube',
    preferredAspectRatio: '16:9',
    provider: 'postforme',
  },
  {
    id: 'tokend',
    name: 'Tokend',
    icon: 'planet',
    preferredAspectRatio: 'any',
    provider: 'tokend',
  },
];

export function getDistributionPlatform(id: SocialPlatform): DistributionPlatformConfig | undefined {
  return DISTRIBUTION_PLATFORMS.find((p) => p.id === id);
}
