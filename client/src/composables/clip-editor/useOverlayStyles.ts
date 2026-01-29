import { type Ref, type ComputedRef, computed } from 'vue';

/**
 * Position configuration for overlay elements
 */
export interface OverlayPosition {
  position_x: number;
  position_y: number;
}

/**
 * Text overlay with position and styling
 */
export interface TextOverlayStyle extends OverlayPosition {
  id: string;
  text: string;
}

/**
 * Sticker with position, scale, and rotation
 */
export interface StickerStyle extends OverlayPosition {
  id: string;
  scale: number;
  rotation: number;
  sticker_path: string;
}

/**
 * Watermark with position, scale, and opacity
 */
export interface WatermarkStyle extends OverlayPosition {
  id: string;
  scale: number;
  opacity: number;
  preview_url?: string;
}

/**
 * Watermark settings from creator profile
 */
export interface WatermarkSettings {
  enabled: boolean;
  watermarkId: string;
  perRatioSettings?: Record<string, any> | null;
}

/**
 * Return type for useOverlayStyles
 */
export interface OverlayStylesReturn {
  /** Get CSS style object for text overlay positioning */
  getTextOverlayStyle: (textOverlay: TextOverlayStyle) => Record<string, string>;
  /** Get CSS style object for sticker positioning, scale, and rotation */
  getStickerStyle: (sticker: StickerStyle) => Record<string, string>;
  /** Get CSS style object for watermark positioning, scale, and opacity */
  getWatermarkStyle: (watermark: WatermarkStyle | null | undefined) => Record<string, string>;
  /** Get base position style (shared helper) */
  getPositionStyle: (position: OverlayPosition) => Record<string, string>;
}

/**
 * Options for useOverlayStyles
 */
export interface OverlayStylesOptions {
  /** Optional watermark settings ref for additional configuration */
  watermarkSettings?: Ref<WatermarkSettings | null> | ComputedRef<WatermarkSettings | null>;
}

/**
 * useOverlayStyles - Extract overlay style calculations from ClipEditorPreview
 *
 * This composable consolidates the repetitive style calculation functions
 * for text overlays, stickers, and watermarks into a single reusable unit.
 *
 * Extracted from ClipEditorPreview.vue lines 421-450:
 * - getTextOverlayStyle()
 * - getStickerStyle()
 * - getWatermarkStyle()
 *
 * Usage:
 * ```ts
 * const { getTextOverlayStyle, getStickerStyle, getWatermarkStyle } = useOverlayStyles();
 *
 * // In template
 * <div :style="getTextOverlayStyle(textOverlay)">{{ textOverlay.text }}</div>
 * <div :style="getStickerStyle(sticker)">{{ sticker.emoji }}</div>
 * <div :style="getWatermarkStyle(watermark)"><img :src="watermark.url" /></div>
 * ```
 */
export function useOverlayStyles(options: OverlayStylesOptions = {}): OverlayStylesReturn {
  /**
   * Get base position style for centered overlay elements
   * Uses percentage-based positioning with centered transform
   */
  function getPositionStyle(position: OverlayPosition): Record<string, string> {
    return {
      left: `${position.position_x}%`,
      top: `${position.position_y}%`,
      transform: 'translate(-50%, -50%)',
    };
  }

  /**
   * Get text overlay style
   * Positions text at percentage coordinates with centered alignment
   */
  function getTextOverlayStyle(textOverlay: TextOverlayStyle): Record<string, string> {
    return getPositionStyle(textOverlay);
  }

  /**
   * Get sticker style
   * Positions sticker with scale and rotation transforms
   */
  function getStickerStyle(sticker: StickerStyle): Record<string, string> {
    return {
      left: `${sticker.position_x}%`,
      top: `${sticker.position_y}%`,
      transform: `translate(-50%, -50%) scale(${sticker.scale}) rotate(${sticker.rotation}deg)`,
    };
  }

  /**
   * Get watermark style
   * Positions watermark with scale and opacity
   */
  function getWatermarkStyle(watermark: WatermarkStyle | null | undefined): Record<string, string> {
    if (!watermark) return {};

    return {
      left: `${watermark.position_x}%`,
      top: `${watermark.position_y}%`,
      transform: `translate(-50%, -50%) scale(${watermark.scale / 100})`,
      opacity: String(watermark.opacity / 100),
    };
  }

  return {
    getTextOverlayStyle,
    getStickerStyle,
    getWatermarkStyle,
    getPositionStyle,
  };
}
