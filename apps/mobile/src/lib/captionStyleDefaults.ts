import type { SubtitleSettings } from '@clippster/shared-types';

/** Matches client SubtitlePropertiesPanel / ManualPOIEditor animation styles. */
export const CAPTION_ANIMATION_STYLES = [
  { id: 'karaoke' as const, name: 'Karaoke', desc: 'Word-by-word color highlight' },
  { id: 'zoom' as const, name: 'Zoom', desc: 'Current word scales up' },
  { id: 'pop' as const, name: 'Pop', desc: 'Bouncy emphasis effect' },
  { id: 'glow' as const, name: 'Glow', desc: 'Glowing word highlight' },
  { id: 'wave' as const, name: 'Wave', desc: 'Floating wave motion' },
  { id: 'single-word' as const, name: 'Single Word', desc: 'One word at a time' },
  { id: 'none' as const, name: 'None', desc: 'Static text, no animation' },
];

export const CAPTION_FONTS = [
  'Montserrat',
  'Impact',
  'Inter',
  'Oswald',
  'Poppins',
  'Roboto',
  'Open Sans',
  'Lato',
  'Arial',
  'Verdana',
];

export const CAPTION_WEIGHTS = [
  { v: 400, l: 'Regular' },
  { v: 600, l: 'Semi' },
  { v: 700, l: 'Bold' },
  { v: 800, l: 'Extra' },
  { v: 900, l: 'Black' },
] as const;

/** Highlight presets from SubtitlePropertiesPanel. */
export const CAPTION_HIGHLIGHT_PRESETS = [
  { name: 'Neon Green', value: '#04F827' },
  { name: 'Yellow', value: '#FFFD03' },
  { name: 'App Cyan', value: '#0ea5e9' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'White', value: '#FFFFFF' },
];

export const CAPTION_TEXT_COLORS = [
  '#FFFFFF',
  '#FACC15',
  '#000000',
  '#EF4444',
  '#22D3EE',
  '#F97316',
  '#A855F7',
];

/** Style-specific defaults when switching animation style (matches desktop getStyleDefaults). */
export function getCaptionStyleDefaults(
  styleId: string,
): Partial<SubtitleSettings> {
  const defaults: Record<string, Partial<SubtitleSettings>> = {
    'single-word': {
      fontFamily: 'Montserrat',
      fontSize: 80,
      fontWeight: 900,
      textColor: '#FFFFFF',
      border1Width: 8,
      border1Color: '#000000',
      border2Width: 0,
      border2Color: '#000000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowColor: '#000000',
      backgroundEnabled: false,
      backgroundColor: 'transparent',
      multiColorEnabled: false,
      highlightColor: '#FFFFFF',
    },
    karaoke: {
      fontFamily: 'Montserrat',
      fontSize: 48,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 3,
      border1Color: '#000000',
      border2Width: 0,
      border2Color: '#000000',
      shadowBlur: 0,
      highlightColor: '#0ea5e9',
      backgroundEnabled: false,
      backgroundColor: 'transparent',
    },
    zoom: {
      fontFamily: 'Montserrat',
      fontSize: 48,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 3,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 0,
      highlightColor: '#22D3EE',
      backgroundEnabled: false,
    },
    pop: {
      fontFamily: 'Montserrat',
      fontSize: 48,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 3,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 0,
      highlightColor: '#EC4899',
      backgroundEnabled: false,
    },
    glow: {
      fontFamily: 'Montserrat',
      fontSize: 44,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 0,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 15,
      shadowColor: '#22D3EE',
      highlightColor: '#22D3EE',
      backgroundEnabled: false,
    },
    wave: {
      fontFamily: 'Montserrat',
      fontSize: 42,
      fontWeight: 600,
      textColor: '#FFFFFF',
      border1Width: 2,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 4,
      shadowColor: 'rgba(0,0,0,0.8)',
      backgroundEnabled: false,
    },
    none: {
      fontFamily: 'Montserrat',
      fontSize: 42,
      fontWeight: 600,
      textColor: '#FFFFFF',
      border1Width: 0,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 4,
      shadowColor: 'rgba(0,0,0,0.8)',
      backgroundEnabled: false,
    },
  };
  return defaults[styleId] ?? {};
}
