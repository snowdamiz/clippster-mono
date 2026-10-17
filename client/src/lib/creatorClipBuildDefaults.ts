import type { CreatorClipBuildDefaults } from '@/types';
export const SUPPORTED_TARGET_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'] as const;
export type SupportedTargetAspectRatio = (typeof SUPPORTED_TARGET_ASPECT_RATIOS)[number];

export function parseCreatorClipBuildDefaults(
  raw: string | null | undefined
): CreatorClipBuildDefaults | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CreatorClipBuildDefaults;
    if (!parsed || typeof parsed !== 'object' || !parsed.targetAspectRatio) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('[useCreatorClipDefaults] Failed to parse clip_build_defaults JSON:', error);
    return null;
  }
}

export function serializeCreatorClipBuildDefaults(
  defaults: CreatorClipBuildDefaults | null
): string | null {
  if (!defaults) return null;
  return JSON.stringify(defaults);
}
