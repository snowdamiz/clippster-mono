import type { SocialPlatform } from '@clippster/api-client'

export interface DistributionPlatformConfig {
  id: SocialPlatform
  name: string
  icon: 'Camera' | 'Music2' | 'X' | 'Video' | 'Globe'
  preferredAspectRatio: '9:16' | '16:9' | 'any'
  provider: 'postforme' | 'tokend'
}

export const DISTRIBUTION_PLATFORMS: DistributionPlatformConfig[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'Camera',
    preferredAspectRatio: '9:16',
    provider: 'postforme'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'Music2',
    preferredAspectRatio: '9:16',
    provider: 'postforme'
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'X',
    preferredAspectRatio: '16:9',
    provider: 'postforme'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'Video',
    preferredAspectRatio: '16:9',
    provider: 'postforme'
  },
  {
    id: 'tokend',
    name: 'Tokend',
    icon: 'Globe',
    preferredAspectRatio: 'any',
    provider: 'tokend'
  }
]

export function getDistributionPlatforms(options?: {
  includeTokend?: boolean
}): DistributionPlatformConfig[] {
  if (options?.includeTokend) return DISTRIBUTION_PLATFORMS
  return DISTRIBUTION_PLATFORMS.filter((platform) => platform.id !== 'tokend')
}

export function getDistributionPlatform(
  id: SocialPlatform
): DistributionPlatformConfig | undefined {
  return DISTRIBUTION_PLATFORMS.find((p) => p.id === id)
}
