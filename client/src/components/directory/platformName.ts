import { normalizePlatform, platformLabel } from '@/components/ui/platform-logo';

/** Human-readable name for any platform id used by campaigns and clipper profiles. */
export function platformName(platform?: string | null): string {
  if (!platform) return '';
  if (normalizePlatform(platform)) return platformLabel(platform);
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
