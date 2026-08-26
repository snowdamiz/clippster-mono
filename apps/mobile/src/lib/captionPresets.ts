import { createDefaultSubtitleSettings, type SubtitleSettings } from '@clippster/shared-types';

export interface CaptionPreset {
  id: string;
  name: string;
  description: string;
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  { id: 'tiktok-bold', name: 'TikTok Bold', description: 'White bold with black outline' },
  { id: 'mr-beast', name: 'Mr Beast', description: 'Yellow highlight karaoke style' },
  { id: 'minimal', name: 'Minimal', description: 'Clean white subtitles' },
  { id: 'boxed', name: 'Boxed', description: 'Text on dark background box' },
  { id: 'single-word', name: 'Single Word', description: 'One word at a time' },
];

export function settingsFromPresetId(presetId: string): SubtitleSettings {
  const base = createDefaultSubtitleSettings();
  base.selectedPresetId = presetId;

  switch (presetId) {
    case 'tiktok-bold':
      return {
        ...base,
        fontSize: 52,
        fontWeight: 900,
        textColor: '#FFFFFF',
        border2Width: 6,
        border2Color: '#000000',
        animationStyle: 'karaoke',
        highlightColor: '#FFFF00',
      };
    case 'mr-beast':
      return {
        ...base,
        fontSize: 56,
        fontWeight: 900,
        textColor: '#FFFFFF',
        border2Width: 5,
        animationStyle: 'karaoke',
        highlightColor: '#FACC15',
      };
    case 'minimal':
      return {
        ...base,
        fontSize: 42,
        fontWeight: 600,
        border1Width: 0,
        border2Width: 0,
        animationStyle: 'none',
        shadowBlur: 0,
      };
    case 'boxed':
      return {
        ...base,
        fontSize: 44,
        backgroundEnabled: true,
        backgroundColor: '#000000CC',
        borderRadius: 8,
        padding: 12,
        animationStyle: 'none',
      };
    case 'single-word':
      return {
        ...base,
        fontSize: 64,
        fontWeight: 900,
        animationStyle: 'single-word',
        border2Width: 5,
      };
    default:
      return base;
  }
}
