/**
 * useStickerInspectorLogic - Business logic for sticker inspector
 *
 * Extracts sticker property formatting, validation, and animation constants
 * from StickerInspector.vue.
 */

import { computed, type Ref } from 'vue';

/**
 * Sticker animation definition
 */
export interface StickerAnimation {
  value: string;
  label: string;
}

/**
 * Available sticker animations
 */
export const STICKER_ANIMATIONS: StickerAnimation[] = [
  { value: 'none', label: 'None' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'spin', label: 'Spin' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'shake', label: 'Shake' },
  { value: 'float', label: 'Float' },
];

/**
 * Sticker property constraints
 */
export const STICKER_CONSTRAINTS = {
  scale: { min: 0.1, max: 3, step: 0.05 },
  rotation: { min: -180, max: 180, step: 1 },
  position: { min: 0, max: 100 },
  time: { min: 0, step: 0.1 },
} as const;

export interface StickerInspectorLogicOptions {
  scale: Ref<number>;
  rotation: Ref<number>;
}

export interface StickerInspectorLogicReturn {
  /** Scale formatted as percentage */
  scalePercent: Ref<string>;
  /** Rotation formatted with degree symbol */
  rotationDegrees: Ref<string>;
  /** Available animations */
  animations: typeof STICKER_ANIMATIONS;
  /** Constraints */
  constraints: typeof STICKER_CONSTRAINTS;
  /** Format scale value */
  formatScale: (scale: number) => string;
  /** Format rotation value */
  formatRotation: (rotation: number) => string;
  /** Validate scale value */
  validateScale: (scale: number) => boolean;
  /** Validate rotation value */
  validateRotation: (rotation: number) => boolean;
  /** Validate position value */
  validatePosition: (position: number) => boolean;
}

/**
 * Format scale as percentage string
 */
export function formatStickerScale(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/**
 * Format rotation with degree symbol
 */
export function formatStickerRotation(rotation: number): string {
  return `${Math.round(rotation)}°`;
}

/**
 * Validate scale is within bounds
 */
export function validateStickerScale(scale: number): boolean {
  return scale >= STICKER_CONSTRAINTS.scale.min && scale <= STICKER_CONSTRAINTS.scale.max;
}

/**
 * Validate rotation is within bounds
 */
export function validateStickerRotation(rotation: number): boolean {
  return rotation >= STICKER_CONSTRAINTS.rotation.min && rotation <= STICKER_CONSTRAINTS.rotation.max;
}

/**
 * Validate position is within bounds
 */
export function validateStickerPosition(position: number): boolean {
  return position >= STICKER_CONSTRAINTS.position.min && position <= STICKER_CONSTRAINTS.position.max;
}

/**
 * Composable for sticker inspector logic
 */
export function useStickerInspectorLogic(options: StickerInspectorLogicOptions): StickerInspectorLogicReturn {
  const { scale, rotation } = options;

  const scalePercent = computed(() => formatStickerScale(scale.value));
  const rotationDegrees = computed(() => formatStickerRotation(rotation.value));

  return {
    scalePercent,
    rotationDegrees,
    animations: STICKER_ANIMATIONS,
    constraints: STICKER_CONSTRAINTS,
    formatScale: formatStickerScale,
    formatRotation: formatStickerRotation,
    validateScale: validateStickerScale,
    validateRotation: validateStickerRotation,
    validatePosition: validateStickerPosition,
  };
}
