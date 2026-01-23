/**
 * useAudioInspectorLogic - Business logic for audio track inspector
 *
 * Extracts volume/pan formatting, fade validation, and property constraints
 * from AudioInspector.vue.
 */

import { computed, type Ref } from 'vue';
import { formatPanLabel, formatVolumePercent } from './useEditorFormatters';

/**
 * Audio property constraints
 */
export const AUDIO_CONSTRAINTS = {
  volume: { min: 0, max: 2, step: 0.01 },
  pan: { min: -1, max: 1, step: 0.01 },
  fade: { min: 0, max: 10, step: 0.1 },
  time: { min: 0, step: 0.1 },
} as const;

export interface AudioInspectorLogicOptions {
  volume: Ref<number>;
  pan: Ref<number>;
}

export interface AudioInspectorLogicReturn {
  /** Volume formatted as percentage */
  volumePercent: Ref<string>;
  /** Pan formatted as label (e.g., "50% L", "Center", "50% R") */
  panLabel: Ref<string>;
  /** Constraints */
  constraints: typeof AUDIO_CONSTRAINTS;
  /** Format volume value */
  formatVolume: (volume: number) => string;
  /** Format pan value */
  formatPan: (pan: number) => string;
  /** Validate volume value */
  validateVolume: (volume: number) => boolean;
  /** Validate pan value */
  validatePan: (pan: number) => boolean;
  /** Validate fade value */
  validateFade: (fade: number) => boolean;
  /** Convert muted/solo boolean to binary (0 or 1) for database */
  toBinary: (value: boolean) => 0 | 1;
  /** Convert binary (0 or 1) to boolean */
  fromBinary: (value: number) => boolean;
}

/**
 * Validate volume is within bounds
 */
export function validateAudioVolume(volume: number): boolean {
  return volume >= AUDIO_CONSTRAINTS.volume.min && volume <= AUDIO_CONSTRAINTS.volume.max;
}

/**
 * Validate pan is within bounds
 */
export function validateAudioPan(pan: number): boolean {
  return pan >= AUDIO_CONSTRAINTS.pan.min && pan <= AUDIO_CONSTRAINTS.pan.max;
}

/**
 * Validate fade time is within bounds
 */
export function validateAudioFade(fade: number): boolean {
  return fade >= AUDIO_CONSTRAINTS.fade.min && fade <= AUDIO_CONSTRAINTS.fade.max;
}

/**
 * Convert boolean to binary for database storage
 */
export function toBinary(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/**
 * Convert binary from database to boolean
 */
export function fromBinary(value: number): boolean {
  return value === 1;
}

/**
 * Composable for audio inspector logic
 */
export function useAudioInspectorLogic(options: AudioInspectorLogicOptions): AudioInspectorLogicReturn {
  const { volume, pan } = options;

  const volumePercent = computed(() => formatVolumePercent(volume.value));
  const panLabel = computed(() => formatPanLabel(pan.value));

  return {
    volumePercent,
    panLabel,
    constraints: AUDIO_CONSTRAINTS,
    formatVolume: formatVolumePercent,
    formatPan: formatPanLabel,
    validateVolume: validateAudioVolume,
    validatePan: validateAudioPan,
    validateFade: validateAudioFade,
    toBinary,
    fromBinary,
  };
}
