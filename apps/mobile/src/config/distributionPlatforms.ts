import type { SocialPlatform } from '@clippster/api-client';

export interface DistributionPlatformConfig {
  id: SocialPlatform;
  name: string;
  icon: 'logo-instagram' | 'logo-tiktok' | 'logo-twitter' | 'logo-youtube';
  preferredAspectRatio: '9:16' | '16:9' | 'any';
}

export const DISTRIBUTION_PLATFORMS: DistributionPlatformConfig[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'logo-instagram',
    preferredAspectRatio: '9:16',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'logo-tiktok',
    preferredAspectRatio: '9:16',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'logo-twitter',
    preferredAspectRatio: '16:9',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'logo-youtube',
    preferredAspectRatio: '16:9',
  },
];

export function getDistributionPlatform(id: SocialPlatform): DistributionPlatformConfig | undefined {
  return DISTRIBUTION_PLATFORMS.find((p) => p.id === id);
}
