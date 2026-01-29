/**
 * useTextInspectorLogic - Business logic for text overlay inspector
 *
 * Extracts style parsing, validation, and constants from TextInspector.vue
 * Provides type-safe style management with proper error handling.
 *
 * Uses TextStyle from useTextTemplates as the canonical style type.
 */

import { computed, type Ref } from 'vue';
import { DEFAULT_TEXT_STYLE, type TextStyle } from './useTextTemplates';

// Re-export for convenience
export type { TextStyle };

/**
 * Available font families for text overlays
 */
export const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Courier New', label: 'Courier New' },
] as const;

/**
 * Available font weights
 */
export const FONT_WEIGHTS = [
  { value: 400, label: 'Normal' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semi-Bold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra-Bold' },
  { value: 900, label: 'Black' },
] as const;

/**
 * Available text animations
 */
export const TEXT_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Typewriter' },
] as const;

/**
 * Style property constraints
 */
export const TEXT_STYLE_CONSTRAINTS = {
  fontSize: { min: 12, max: 200 },
  position: { min: 0, max: 100 },
} as const;

export interface TextInspectorLogicOptions {
  styleData: Ref<string | null | undefined>;
}

export interface TextInspectorLogicReturn {
  /** Parsed style object with defaults applied */
  style: Ref<TextStyle>;
  /** Parse style JSON safely */
  parseStyle: (styleData: string | null | undefined) => TextStyle;
  /** Merge a style property update into existing style */
  mergeStyle: (currentStyle: TextStyle, property: keyof TextStyle, value: any) => TextStyle;
  /** Serialize style to JSON string */
  serializeStyle: (style: TextStyle) => string;
  /** Validate a style property value */
  validateStyleProperty: (property: keyof TextStyle, value: any) => boolean;
  /** Constants */
  fontFamilies: typeof FONT_FAMILIES;
  fontWeights: typeof FONT_WEIGHTS;
  textAnimations: typeof TEXT_ANIMATIONS;
  constraints: typeof TEXT_STYLE_CONSTRAINTS;
  defaultStyle: TextStyle;
}

/**
 * Parse style JSON safely with error handling
 */
export function parseStyle(styleData: string | null | undefined): TextStyle {
  if (!styleData) return { ...DEFAULT_TEXT_STYLE };

  try {
    const parsed = JSON.parse(styleData);
    return {
      ...DEFAULT_TEXT_STYLE,
      ...parsed,
    };
  } catch {
    console.warn('[useTextInspectorLogic] Failed to parse style_data, using defaults');
    return { ...DEFAULT_TEXT_STYLE };
  }
}

/**
 * Merge a style property update into existing style
 */
export function mergeStyle(currentStyle: TextStyle, property: keyof TextStyle, value: any): TextStyle {
  return {
    ...currentStyle,
    [property]: value,
  };
}

/**
 * Serialize style to JSON string
 */
export function serializeStyle(style: TextStyle): string {
  return JSON.stringify(style);
}

/**
 * Validate a style property value
 */
export function validateStyleProperty(property: keyof TextStyle, value: any): boolean {
  switch (property) {
    case 'fontSize':
      return (
        typeof value === 'number' &&
        value >= TEXT_STYLE_CONSTRAINTS.fontSize.min &&
        value <= TEXT_STYLE_CONSTRAINTS.fontSize.max
      );
    case 'fontWeight':
      return FONT_WEIGHTS.some((w) => w.value === value);
    case 'fontFamily':
      return FONT_FAMILIES.some((f) => f.value === value);
    case 'color':
      return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
    default:
      return true;
  }
}

/**
 * Composable for text inspector logic
 */
export function useTextInspectorLogic(options: TextInspectorLogicOptions): TextInspectorLogicReturn {
  const { styleData } = options;

  const style = computed(() => parseStyle(styleData.value));

  return {
    style,
    parseStyle,
    mergeStyle,
    serializeStyle,
    validateStyleProperty,
    fontFamilies: FONT_FAMILIES,
    fontWeights: FONT_WEIGHTS,
    textAnimations: TEXT_ANIMATIONS,
    constraints: TEXT_STYLE_CONSTRAINTS,
    defaultStyle: DEFAULT_TEXT_STYLE,
  };
}
