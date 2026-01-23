/**
 * useWatermarkSettings - Business logic for watermark configuration
 *
 * Extracts watermark state management, position presets, and per-ratio
 * settings from WatermarkPanel.vue.
 */

import { ref, computed, watch, type Ref } from 'vue';

/**
 * Watermark settings for a single aspect ratio
 */
export interface WatermarkConfig {
  positionX: number;
  positionY: number;
  scale: number;
  opacity: number;
  startTime: number;
  endTime: number;
}

/**
 * Position preset definition
 */
export interface PositionPreset {
  id: string;
  label: string;
  x: number;
  y: number;
}

/**
 * Available aspect ratios for watermark configuration
 */
export const WATERMARK_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'] as const;
export type WatermarkAspectRatio = (typeof WATERMARK_ASPECT_RATIOS)[number];

/**
 * Position presets for quick positioning
 */
export const POSITION_PRESETS: PositionPreset[] = [
  { id: 'top-left', label: 'Top Left', x: 8, y: 8 },
  { id: 'top-center', label: 'Top Center', x: 50, y: 8 },
  { id: 'top-right', label: 'Top Right', x: 92, y: 8 },
  { id: 'center-left', label: 'Center Left', x: 8, y: 50 },
  { id: 'center', label: 'Center', x: 50, y: 50 },
  { id: 'center-right', label: 'Center Right', x: 92, y: 50 },
  { id: 'bottom-left', label: 'Bottom Left', x: 8, y: 92 },
  { id: 'bottom-center', label: 'Bottom Center', x: 50, y: 92 },
  { id: 'bottom-right', label: 'Bottom Right', x: 92, y: 92 },
];

/**
 * Default watermark settings
 */
export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  positionX: 92,
  positionY: 92,
  scale: 20,
  opacity: 80,
  startTime: 0,
  endTime: 0,
};

/**
 * Watermark setting constraints
 */
export const WATERMARK_CONSTRAINTS = {
  position: { min: 0, max: 100 },
  scale: { min: 5, max: 100 },
  opacity: { min: 0, max: 100 },
  time: { min: 0, step: 0.1 },
} as const;

export interface WatermarkSettingsOptions {
  /** Initial enabled state from creator watermark */
  initialEnabled?: boolean;
  /** Initial aspect ratio */
  initialRatio?: WatermarkAspectRatio;
  /** Initial settings to load (e.g., from database) */
  initialSettings?: Record<WatermarkAspectRatio, WatermarkConfig> | null;
  /** Callback when settings change */
  onSettingsChange?: (ratio: WatermarkAspectRatio, config: WatermarkConfig) => void;
  /** Callback to save settings (implement for database persistence) */
  onSave?: (settings: Record<WatermarkAspectRatio, WatermarkConfig>) => Promise<void>;
}

export interface WatermarkSettingsReturn {
  /** Whether watermark is enabled */
  enabled: Ref<boolean>;
  /** Currently selected aspect ratio */
  selectedRatio: Ref<WatermarkAspectRatio>;
  /** Current watermark config for selected ratio */
  currentConfig: Ref<WatermarkConfig>;
  /** All settings by ratio */
  settingsByRatio: Ref<Record<WatermarkAspectRatio, WatermarkConfig>>;
  /** Whether settings are currently being saved */
  isSaving: Ref<boolean>;
  /** Whether settings have unsaved changes */
  hasUnsavedChanges: Ref<boolean>;
  /** Available aspect ratios */
  aspectRatios: typeof WATERMARK_ASPECT_RATIOS;
  /** Position presets */
  positionPresets: typeof POSITION_PRESETS;
  /** Constraints */
  constraints: typeof WATERMARK_CONSTRAINTS;
  /** Apply a position preset */
  applyPreset: (preset: PositionPreset) => void;
  /** Update a config property */
  updateConfig: <K extends keyof WatermarkConfig>(property: K, value: WatermarkConfig[K]) => void;
  /** Get settings for a specific ratio */
  getSettingsForRatio: (ratio: WatermarkAspectRatio) => WatermarkConfig;
  /** Reset settings to defaults */
  resetToDefaults: () => void;
  /** Save settings (calls onSave callback if provided) */
  saveSettings: () => Promise<void>;
  /** Load settings from external source */
  loadSettings: (settings: Record<WatermarkAspectRatio, WatermarkConfig>) => void;
  /** Format scale for display */
  formatScale: (scale: number) => string;
  /** Format opacity for display */
  formatOpacity: (opacity: number) => string;
}

/**
 * Format scale value for display
 */
export function formatScale(scale: number): string {
  return `${Math.round(scale)}%`;
}

/**
 * Format opacity value for display
 */
export function formatOpacity(opacity: number): string {
  return `${Math.round(opacity)}%`;
}

/**
 * Composable for watermark settings management
 */
export function useWatermarkSettings(options: WatermarkSettingsOptions = {}): WatermarkSettingsReturn {
  const {
    initialEnabled = false,
    initialRatio = '16:9',
    initialSettings,
    onSettingsChange,
    onSave,
  } = options;

  // State
  const enabled = ref(initialEnabled);
  const selectedRatio = ref<WatermarkAspectRatio>(initialRatio);
  const isSaving = ref(false);
  const hasUnsavedChanges = ref(false);

  // Per-ratio settings storage - initialize from provided settings or defaults
  const settingsByRatio = ref<Record<WatermarkAspectRatio, WatermarkConfig>>(
    initialSettings
      ? { ...initialSettings }
      : WATERMARK_ASPECT_RATIOS.reduce(
          (acc, ratio) => {
            acc[ratio] = { ...DEFAULT_WATERMARK_CONFIG };
            return acc;
          },
          {} as Record<WatermarkAspectRatio, WatermarkConfig>
        )
  );

  // Current config computed from selected ratio
  const currentConfig = computed(() => settingsByRatio.value[selectedRatio.value]);

  // Mark as having unsaved changes
  function markDirty(): void {
    hasUnsavedChanges.value = true;
  }

  // Apply a position preset
  function applyPreset(preset: PositionPreset): void {
    const config = settingsByRatio.value[selectedRatio.value];
    config.positionX = preset.x;
    config.positionY = preset.y;
    markDirty();
    onSettingsChange?.(selectedRatio.value, config);
  }

  // Update a config property
  function updateConfig<K extends keyof WatermarkConfig>(property: K, value: WatermarkConfig[K]): void {
    settingsByRatio.value[selectedRatio.value][property] = value;
    markDirty();
    onSettingsChange?.(selectedRatio.value, settingsByRatio.value[selectedRatio.value]);
  }

  // Get settings for a specific ratio
  function getSettingsForRatio(ratio: WatermarkAspectRatio): WatermarkConfig {
    return settingsByRatio.value[ratio];
  }

  // Reset to defaults
  function resetToDefaults(): void {
    WATERMARK_ASPECT_RATIOS.forEach((ratio) => {
      settingsByRatio.value[ratio] = { ...DEFAULT_WATERMARK_CONFIG };
    });
    markDirty();
  }

  // Load settings from external source
  function loadSettings(settings: Record<WatermarkAspectRatio, WatermarkConfig>): void {
    WATERMARK_ASPECT_RATIOS.forEach((ratio) => {
      if (settings[ratio]) {
        settingsByRatio.value[ratio] = { ...settings[ratio] };
      }
    });
    hasUnsavedChanges.value = false;
  }

  // Save settings
  async function saveSettings(): Promise<void> {
    if (!onSave) {
      console.warn('[useWatermarkSettings] No onSave callback provided - settings not persisted');
      hasUnsavedChanges.value = false;
      return;
    }

    isSaving.value = true;

    try {
      await onSave(settingsByRatio.value);
      hasUnsavedChanges.value = false;
      console.log('[useWatermarkSettings] Settings saved successfully');
    } catch (error) {
      console.error('[useWatermarkSettings] Failed to save settings:', error);
      throw error;
    } finally {
      isSaving.value = false;
    }
  }

  return {
    enabled,
    selectedRatio,
    currentConfig,
    settingsByRatio,
    isSaving,
    hasUnsavedChanges,
    aspectRatios: WATERMARK_ASPECT_RATIOS,
    positionPresets: POSITION_PRESETS,
    constraints: WATERMARK_CONSTRAINTS,
    applyPreset,
    updateConfig,
    getSettingsForRatio,
    resetToDefaults,
    saveSettings,
    loadSettings,
    formatScale,
    formatOpacity,
  };
}
