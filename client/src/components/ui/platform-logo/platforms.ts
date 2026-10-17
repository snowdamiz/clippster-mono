
/**
 * Streaming / social platform identity helpers shared by every screen that
 * shows a platform logo (Live streams, Download video/audio, creators, ...).
 * Platform ids are matched case-insensitively, so both the app's
 * `PlatformId` values ('kick', 'YouTube', ...) and display names ('Kick',
 * 'PumpFun', 'Twitter', ...) work.
 */
export type PlatformKey =
  | 'kick'
  | 'twitch'
  | 'youtube'
  | 'rumble'
  | 'x'
  | 'pumpfun'
  | 'tokend'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'snapchat'
  /** Not a platform: local/manual uploads (neutral tile). */
  | 'manual'

export function normalizePlatform(platform?: string | null): PlatformKey | null {
  const key = (platform || '').trim().toLowerCase()
  switch (key) {
    case 'kick':
      return 'kick'
    case 'twitch':
      return 'twitch'
    case 'youtube':
      return 'youtube'
    case 'rumble':
      return 'rumble'
    case 'x':
    case 'twitter':
    case 'x (twitter)':
      return 'x'
    case 'pumpfun':
    case 'pump.fun':
    case 'pump':
      return 'pumpfun'
    case 'tokend':
      return 'tokend'
    case 'tiktok':
    case 'tiktok_business':
    case 'tiktok business':
      return 'tiktok'
    case 'instagram':
    case 'ig':
      return 'instagram'
    case 'facebook':
    case 'fb':
      return 'facebook'
    case 'snapchat':
    case 'snap':
      return 'snapchat'
    case 'manual':
      return 'manual'
    default:
      return null
  }
}

/** Logos shipped as files in /public. Instagram, Facebook, Snapchat and Manual use icon glyphs instead. */
const LOGOS: Partial<Record<PlatformKey, string>> = {
  kick: '/kick.svg',
  twitch: '/twitch.svg',
  youtube: '/youtube.svg',
  rumble: '/rumble.svg',
  x: '/x.svg',
  pumpfun: '/capsule.svg',
  tokend: '/tokend.png',
  tiktok: '/tiktok.svg',
}

const LABELS: Record<PlatformKey, string> = {
  kick: 'Kick',
  twitch: 'Twitch',
  youtube: 'YouTube',
  rumble: 'Rumble',
  x: 'X',
  pumpfun: 'PumpFun',
  tokend: 'Tokend',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
  manual: 'Manual',
}

/** Logo asset path for a platform (served from /public). */
export function platformLogoSrc(platform?: string | null): string {
  const key = normalizePlatform(platform)
  return (key && LOGOS[key]) || ''
}

/** Every platform PlatformLogo knows how to draw. */
export const KNOWN_PLATFORMS: PlatformKey[] = [
  'kick',
  'twitch',
  'youtube',
  'rumble',
  'x',
  'pumpfun',
  'tokend',
  'tiktok',
  'instagram',
  'facebook',
  'snapchat',
]

/** Human-readable platform name (unknown ids are returned as given). */
export function platformLabel(platform?: string | null): string {
  const key = normalizePlatform(platform)
  return key ? LABELS[key] : platform || ''
}
