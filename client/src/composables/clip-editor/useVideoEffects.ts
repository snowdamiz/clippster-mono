import { computed, type Ref, type ComputedRef } from 'vue';
import type {
  FullVideoEditorEdit,
  VideoEditorEffectRecord,
} from '@/services/database/video-editor-edits';

/**
 * Parsed effect settings
 */
export interface EffectSettings {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  hue?: number;
  grayscale?: number;
  sepia?: number;
  invert?: number;
}

/**
 * Return type for useVideoEffects
 */
export interface VideoEffectsReturn {
  /**
   * CSS filter string computed from active effects at the current time
   */
  appliedCSSFilters: ComputedRef<string>;

  /**
   * Get effects active at a specific time
   */
  getActiveEffects: (time: number) => VideoEditorEffectRecord[];

  /**
   * Build CSS filter string from a list of effects
   */
  buildCSSFilters: (effects: VideoEditorEffectRecord[]) => string;

  /**
   * Get CSS filters for a specific time
   */
  getCSSFiltersAtTime: (time: number) => string;
}

/**
 * useVideoEffects - Build CSS filter strings from effect configurations
 *
 * Extracts the CSS filter building logic from ClipEditorPreview (lines 299-331)
 *
 * Effects support various filter types:
 * - brightness: 100 = normal, 0 = black, 200 = 2x bright
 * - contrast: 100 = normal
 * - saturation: 100 = normal, 0 = grayscale
 * - blur: pixels
 * - hue: degrees (hue-rotate)
 * - grayscale: 0-100%
 * - sepia: 0-100%
 * - invert: 0-100%
 *
 * Usage:
 * ```ts
 * const { appliedCSSFilters, getCSSFiltersAtTime } = useVideoEffects({
 *   editorEdit,
 *   currentTime
 * });
 *
 * // Use in template
 * <video :style="{ filter: appliedCSSFilters }" />
 *
 * // Or get filters for a specific time
 * const filters = getCSSFiltersAtTime(10.5);
 * ```
 */
export function useVideoEffects(options: {
  editorEdit: Ref<FullVideoEditorEdit | null>;
  currentTime: Ref<number>;
}): VideoEffectsReturn {
  const { editorEdit, currentTime } = options;

  /**
   * Get all effects from the editor edit
   */
  const allEffects = computed(() => editorEdit.value?.effects || []);

  /**
   * Get effects active at a specific time
   */
  function getActiveEffects(time: number): VideoEditorEffectRecord[] {
    return allEffects.value.filter(
      (effect) => time >= effect.start_time && time <= effect.end_time
    );
  }

  /**
   * Parse effect settings from JSON string
   */
  function parseSettings(settingsJson: string): EffectSettings {
    try {
      return JSON.parse(settingsJson || '{}');
    } catch {
      return {};
    }
  }

  /**
   * Build CSS filter string from a list of effects
   */
  function buildCSSFilters(effects: VideoEditorEffectRecord[]): string {
    if (effects.length === 0) return '';

    const filters: string[] = [];

    effects.forEach((effect) => {
      const settings = parseSettings(effect.settings);

      if (effect.effect_type === 'filter') {
        // Apply filter settings
        if (settings.brightness !== undefined) {
          filters.push(`brightness(${settings.brightness}%)`);
        }
        if (settings.contrast !== undefined) {
          filters.push(`contrast(${settings.contrast}%)`);
        }
        if (settings.saturation !== undefined) {
          filters.push(`saturate(${settings.saturation}%)`);
        }
        if (settings.blur !== undefined && settings.blur > 0) {
          filters.push(`blur(${settings.blur}px)`);
        }
        if (settings.hue !== undefined && settings.hue !== 0) {
          filters.push(`hue-rotate(${settings.hue}deg)`);
        }
        if (settings.grayscale !== undefined && settings.grayscale > 0) {
          filters.push(`grayscale(${settings.grayscale}%)`);
        }
        if (settings.sepia !== undefined && settings.sepia > 0) {
          filters.push(`sepia(${settings.sepia}%)`);
        }
        if (settings.invert !== undefined && settings.invert > 0) {
          filters.push(`invert(${settings.invert}%)`);
        }
      }
    });

    return filters.join(' ');
  }

  /**
   * Get CSS filters for a specific time
   */
  function getCSSFiltersAtTime(time: number): string {
    const activeEffects = getActiveEffects(time);
    return buildCSSFilters(activeEffects);
  }

  /**
   * CSS filter string computed from active effects at the current time
   */
  const appliedCSSFilters = computed(() => {
    return getCSSFiltersAtTime(currentTime.value);
  });

  return {
    appliedCSSFilters,
    getActiveEffects,
    buildCSSFilters,
    getCSSFiltersAtTime,
  };
}
