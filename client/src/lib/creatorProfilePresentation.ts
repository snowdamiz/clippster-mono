import type { PlatformId } from '@/config/platforms';
  export function getPlatformIcon(platform: PlatformId, base = '/'): string {
    const icons: Record<PlatformId, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      YouTube: '/youtube.svg',
      rumble: '/rumble.svg',
      twitter: '/x.svg',
      tokend: '/tokend.png',
    };
    return base.replace(/\/$/, '') + (icons[platform] || '/capsule.svg');
  }

  export function getPlatformFilter(platform: PlatformId): string {
    const filters: Record<PlatformId, string> = {
      pumpfun: 'brightness(0) saturate(100%) invert(67%) sepia(52%) saturate(559%) hue-rotate(109deg) brightness(93%) contrast(92%)',
      kick: 'brightness(0) saturate(100%) invert(83%) sepia(47%) saturate(1113%) hue-rotate(57deg) brightness(106%) contrast(98%)',
      twitch: 'brightness(0) saturate(100%) invert(37%) sepia(98%) saturate(1932%) hue-rotate(249deg) brightness(93%) contrast(109%)',
      YouTube: 'brightness(0) saturate(100%) invert(22%) sepia(99%) saturate(3013%) hue-rotate(352deg) brightness(95%) contrast(91%)',
      rumble: 'brightness(0) saturate(100%) invert(83%) sepia(47%) saturate(1113%) hue-rotate(57deg) brightness(106%) contrast(98%)',
      twitter: 'brightness(0) invert(100%)',
      tokend: 'none',
    };
    return filters[platform] || 'none';
  }


