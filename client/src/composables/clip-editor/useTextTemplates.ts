/**
 * Text style configuration
 */
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string | null;
  backgroundEnabled: boolean;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  border1Width: number;
  border1Color: string;
  border2Width: number;
  border2Color: string;
  padding: number;
  borderRadius: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  maxWidth: number;
}

/**
 * Template definition
 */
export interface TextTemplate {
  id: string;
  label: string;
  preset: string;
}

/**
 * Template style overrides (includes position_y for placement)
 */
export type TemplateStyleOverride = Partial<TextStyle> & { position_y?: number };

/**
 * Text overlay data for creation
 */
export interface TextOverlayData {
  text: string;
  start_time: number;
  end_time: number;
  position_x: number;
  position_y: number;
  style_data: string;
  animation: string;
}

/**
 * Default text style configuration
 */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 48,
  fontWeight: 700,
  color: '#ffffff',
  backgroundColor: null,
  backgroundEnabled: false,
  strokeEnabled: true,
  strokeColor: '#000000',
  strokeWidth: 2,
  shadowEnabled: true,
  shadowColor: '#000000',
  shadowBlur: 4,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  border1Width: 0,
  border1Color: '#000000',
  border2Width: 0,
  border2Color: '#000000',
  padding: 16,
  borderRadius: 8,
  letterSpacing: 0,
  lineHeight: 1.2,
  textAlign: 'center',
  maxWidth: 80,
};

/**
 * Available text templates
 */
export const TEXT_TEMPLATES: TextTemplate[] = [
  { id: 'title', label: 'Title', preset: 'title' },
  { id: 'subtitle', label: 'Subtitle', preset: 'lower-third' },
  { id: 'caption', label: 'Caption', preset: 'caption' },
  { id: 'quote', label: 'Quote', preset: 'quote' },
];

/**
 * Template-specific style overrides
 */
export const TEMPLATE_STYLES: Record<string, TemplateStyleOverride> = {
  title: {
    fontSize: 64,
    fontWeight: 800,
    position_y: 20,
  },
  'lower-third': {
    fontSize: 32,
    fontWeight: 600,
    position_y: 85,
    backgroundEnabled: true,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  caption: {
    fontSize: 28,
    fontWeight: 600,
    position_y: 90,
  },
  quote: {
    fontSize: 40,
    fontWeight: 500,
  },
};

/**
 * Return type for useTextTemplates
 */
export interface TextTemplatesReturn {
  /** Available text templates */
  templates: TextTemplate[];
  /** Default text style */
  defaultStyle: TextStyle;
  /** Merge template preset with default style */
  mergeWithDefaults: (preset: string) => { style: TextStyle; positionY: number };
  /** Create text overlay data from template */
  createTextData: (template: TextTemplate, currentTime: number) => TextOverlayData;
  /** Create default text overlay data */
  createDefaultTextData: (currentTime: number) => TextOverlayData;
}

/**
 * useTextTemplates - Text template management for the clip editor
 *
 * Extracts hardcoded template configuration from TextPanel.vue into a
 * reusable composable with typed interfaces.
 *
 * Usage:
 * ```ts
 * const { templates, createTextData, createDefaultTextData } = useTextTemplates();
 *
 * // Add from template
 * const data = createTextData(template, currentTime);
 * await createText(data);
 *
 * // Add default text
 * const data = createDefaultTextData(currentTime);
 * await createText(data);
 * ```
 */
export function useTextTemplates(): TextTemplatesReturn {
  /**
   * Merge a template preset with default styles
   */
  function mergeWithDefaults(preset: string): { style: TextStyle; positionY: number } {
    const overrides = TEMPLATE_STYLES[preset] || {};
    const { position_y, ...styleProps } = overrides;

    return {
      style: { ...DEFAULT_TEXT_STYLE, ...styleProps },
      positionY: position_y ?? 50,
    };
  }

  /**
   * Create text overlay data from a template
   */
  function createTextData(template: TextTemplate, currentTime: number): TextOverlayData {
    const { style, positionY } = mergeWithDefaults(template.preset);

    return {
      text: template.label,
      start_time: currentTime,
      end_time: currentTime + 3,
      position_x: 50,
      position_y: positionY,
      style_data: JSON.stringify(style),
      animation: 'fade',
    };
  }

  /**
   * Create default text overlay data
   */
  function createDefaultTextData(currentTime: number): TextOverlayData {
    return {
      text: 'New Text',
      start_time: currentTime,
      end_time: currentTime + 3,
      position_x: 50,
      position_y: 50,
      style_data: JSON.stringify(DEFAULT_TEXT_STYLE),
      animation: 'fade',
    };
  }

  return {
    templates: TEXT_TEMPLATES,
    defaultStyle: DEFAULT_TEXT_STYLE,
    mergeWithDefaults,
    createTextData,
    createDefaultTextData,
  };
}
