/**
 * useWatermarkSettingsTransform - Transform watermark settings for preview/export
 *
 * Extracted from ClipEditorDialog.vue to centralize watermark settings transformation.
 * Converts creator profile watermark configuration into a format usable by the editor components.
 */

import { computed, type ComputedRef, type Ref, isRef } from 'vue';

export interface WatermarkSettingsInput {
  enabled: boolean;
  watermarkId: string;
  perRatioSettings: Record<string, any> | null;
}

export interface WatermarkSettingsTransformOptions {
  /** Watermark ID from creator profile (can be null if not set) */
  watermarkId: Ref<string | null | undefined> | string | null | undefined;
  /** JSON string of per-ratio watermark settings (can be null) */
  watermarkSettingsJson: Ref<string | null | undefined> | string | null | undefined;
}

export interface WatermarkSettingsTransformReturn {
  /** Transformed watermark settings ready for use by editor components */
  watermarkSettings: ComputedRef<WatermarkSettingsInput | null>;
}

/**
 * Transform raw watermark settings from creator profile into editor-ready format
 */
export function useWatermarkSettingsTransform(
  options: WatermarkSettingsTransformOptions
): WatermarkSettingsTransformReturn {
  const { watermarkId, watermarkSettingsJson } = options;

  const watermarkSettings = computed<WatermarkSettingsInput | null>(() => {
    const id = isRef(watermarkId) ? watermarkId.value : watermarkId;
    const settingsJson = isRef(watermarkSettingsJson) ? watermarkSettingsJson.value : watermarkSettingsJson;

    if (!id) return null;

    let perRatioSettings: Record<string, any> | null = null;

    if (settingsJson) {
      try {
        perRatioSettings = JSON.parse(settingsJson);
      } catch (error) {
        console.error('[useWatermarkSettingsTransform] Failed to parse watermark settings JSON:', error);
        perRatioSettings = null;
      }
    }

    return {
      enabled: true,
      watermarkId: id,
      perRatioSettings,
    };
  });

  return {
    watermarkSettings,
  };
}
