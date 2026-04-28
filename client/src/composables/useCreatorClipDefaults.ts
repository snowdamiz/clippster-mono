import type {
  ActiveVodPresetConfig,
  CreatorClipBuildDefaults,
  ManualFramingConfig,
  SubtitleSettings,
} from '@/types';
import { updateCreatorProfile, getCreatorProfile } from '@/services/database/creator-profiles';

/**
 * Helpers for the per-creator "clip build defaults" feature.
 *
 * Defaults live as a JSON string on `creator_profiles.clip_build_defaults`.
 * They are intentionally only consumed when a user opts in (via the
 * "Use creator layout" checkbox on the VOD download flow), at which point
 * they are mapped into the same `active_vod_preset_config` shape the
 * rest of the app already understands.
 */

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
    // Legacy: Twitch live preview option removed from UI — treat as no reference image.
    if (parsed.referenceImageSource === 'twitch_preview') {
      parsed.referenceImageSource = 'none';
      parsed.referenceImageUrl = null;
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

export async function getCreatorClipBuildDefaults(
  creatorProfileId: string
): Promise<CreatorClipBuildDefaults | null> {
  const profile = await getCreatorProfile(creatorProfileId);
  if (!profile) return null;
  return parseCreatorClipBuildDefaults(profile.clip_build_defaults ?? null);
}

export async function saveCreatorClipBuildDefaults(
  creatorProfileId: string,
  defaults: CreatorClipBuildDefaults | null
): Promise<void> {
  await updateCreatorProfile(creatorProfileId, {
    clip_build_defaults: serializeCreatorClipBuildDefaults(defaults),
  });
}

/**
 * Build an `ActiveVodPresetConfig` snapshot from a creator's clip build defaults.
 * The snapshot is what gets persisted onto `projects.active_vod_preset_config`
 * so detection and the workspace pick it up like a normal pre-edit preset.
 */
export function buildActiveVodPresetFromCreatorDefaults(
  defaults: CreatorClipBuildDefaults
): ActiveVodPresetConfig {
  // Make sure framingConfig.targetAspectRatio matches the chosen target
  // (defensive — UI should already keep these aligned).
  const framingConfig: ManualFramingConfig | null = defaults.framingConfig
    ? {
        ...defaults.framingConfig,
        targetAspectRatio: defaults.targetAspectRatio,
      }
    : null;

  return {
    presetId: null,
    targetAspectRatio: defaults.targetAspectRatio,
    framingConfig,
    layoutOverlays: defaults.layoutOverlays
      ? JSON.parse(JSON.stringify(defaults.layoutOverlays))
      : [],
    watermarkMode: defaults.watermarkMode ?? 'creator',
    customWatermarkSettings: defaults.customWatermarkSettings
      ? JSON.parse(JSON.stringify(defaults.customWatermarkSettings))
      : null,
    subtitleDefaults: defaults.subtitleDefaults
      ? JSON.parse(JSON.stringify(defaults.subtitleDefaults))
      : null,
  };
}

/**
 * Pull the subtitle defaults out of a creator's clip build defaults.
 * Used when initializing subtitle state for clips created against a project
 * that was seeded from creator defaults.
 */
export function getCreatorSubtitleDefaults(
  defaults: CreatorClipBuildDefaults | null
): SubtitleSettings | null {
  if (!defaults || !defaults.subtitleDefaults) return null;
  return JSON.parse(JSON.stringify(defaults.subtitleDefaults));
}

