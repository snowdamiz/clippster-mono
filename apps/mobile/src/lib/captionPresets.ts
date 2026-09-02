import { createDefaultSubtitleSettings, type SubtitleSettings } from '@clippster/shared-types';

export const DEFAULT_CAPTION_PRESET_ID = 'tiktok-bold';

export interface CaptionPresetPreview {
  text: string;
  color: string;
  fontWeight: '400' | '700' | '900';
  letterSpacing?: number;
  backgroundColor?: string;
  textShadowColor?: string;
  textShadowRadius?: number;
  uppercase?: boolean;
}

export interface CaptionPreset {
  id: string;
  name: string;
  description: string;
  preview: CaptionPresetPreview;
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: 'mr-beast',
    name: 'MrBeast',
    description: 'Bold yellow, YouTube style',
    preview: {
      text: 'SAMPLE TEXT',
      color: '#FACC15',
      fontWeight: '900',
      letterSpacing: 1.5,
      textShadowColor: '#000000',
      textShadowRadius: 2,
      uppercase: true,
    },
  },
  {
    id: 'tiktok-bold',
    name: 'TikTok Bold',
    description: 'White text, thick outline',
    preview: {
      text: 'SAMPLE TEXT',
      color: '#FFFFFF',
      fontWeight: '900',
      backgroundColor: 'rgba(0,0,0,0.8)',
    },
  },
  {
    id: 'subtitle-tutorial',
    name: 'Clean Subtitle',
    description: 'Professional, readable',
    preview: {
      text: 'Sample Text',
      color: '#FFFFFF',
      fontWeight: '400',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    description: 'Cyan glow, modern',
    preview: {
      text: 'SAMPLE TEXT',
      color: '#FFFFFF',
      fontWeight: '700',
      textShadowColor: '#22D3EE',
      textShadowRadius: 10,
    },
  },
  {
    id: 'karaoke',
    name: 'Karaoke',
    description: 'Word-by-word highlight',
    preview: {
      text: 'WORD BY WORD',
      color: '#FFFFFF',
      fontWeight: '700',
    },
  },
];

export function settingsFromPresetId(presetId: string): SubtitleSettings {
  const base = createDefaultSubtitleSettings();
  base.selectedPresetId = presetId;
  base.enabled = true;
  base.fontFamily = 'Montserrat';
  base.fontSize = 48;
  base.fontWeight = 900;
  base.textColor = '#FFFFFF';
  base.backgroundColor = 'rgba(0,0,0,0)';
  base.backgroundEnabled = false;
  base.border1Width = 0;
  base.border1Color = '#000000';
  base.border2Width = 3;
  base.border2Color = '#000000';
  base.shadowBlur = 0;
  base.shadowColor = '#000000';
  base.shadowOffsetX = 2;
  base.shadowOffsetY = 2;
  base.highlightColor = '#FACC15';
  base.animationStyle = 'karaoke';
  base.positionPercentage = 80;
  base.wordSpacing = 0.35;

  switch (presetId) {
    case 'mr-beast':
      return {
        ...base,
        textColor: '#FACC15',
        fontFamily: 'Bebas Neue',
        border2Width: 4,
        highlightColor: '#FFFFFF',
        animationStyle: 'zoom',
        fontSize: 56,
      };
    case 'tiktok-bold':
      return {
        ...base,
        textColor: '#FFFFFF',
        backgroundEnabled: true,
        backgroundColor: 'rgba(0,0,0,0.8)',
        border2Width: 0,
        animationStyle: 'karaoke',
        fontSize: 52,
      };
    case 'subtitle-tutorial':
      return {
        ...base,
        textColor: '#FFFFFF',
        fontFamily: 'Roboto',
        fontWeight: 400,
        fontSize: 40,
        backgroundEnabled: true,
        backgroundColor: 'rgba(0,0,0,0.6)',
        border2Width: 0,
        animationStyle: 'none',
      };
    case 'neon-glow':
      return {
        ...base,
        textColor: '#FFFFFF',
        shadowBlur: 15,
        shadowColor: '#22D3EE',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        highlightColor: '#22D3EE',
        animationStyle: 'glow',
      };
    case 'karaoke':
      return {
        ...base,
        textColor: '#FFFFFF',
        highlightColor: '#FACC15',
        animationStyle: 'karaoke',
      };
    default:
      return { ...base, selectedPresetId: DEFAULT_CAPTION_PRESET_ID };
  }
}
