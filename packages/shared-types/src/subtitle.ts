export interface SubtitleOverride {
  fontSize: number;
  positionPercentage: number;
  position?: { x: number; y: number };
  maxWidth?: number;
  presetId?: string;
  animationStyle?:
    | 'none'
    | 'karaoke'
    | 'zoom'
    | 'pop'
    | 'glow'
    | 'box-highlight'
    | 'typewriter'
    | 'wave'
    | 'single-word';
  textColor?: string;
  fontFamily?: string;
  fontWeight?: number;
  border1Width?: number;
  border1Color?: string;
  border2Width?: number;
  border2Color?: string;
  highlightColor?: string;
  multiColorEnabled?: boolean;
  multiColorMode?: 'default' | 'custom';
  colorPalette?: string[];
}

export interface SubtitleSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundEnabled: boolean;
  border1Width: number;
  border1Color: string;
  border2Width: number;
  border2Color: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;
  position: 'top' | 'middle' | 'bottom';
  positionPercentage: number;
  maxWidth: number;
  animationStyle:
    | 'none'
    | 'karaoke'
    | 'zoom'
    | 'pop'
    | 'glow'
    | 'box-highlight'
    | 'typewriter'
    | 'wave'
    | 'single-word';
  highlightColor: string;
  multiColorEnabled: boolean;
  multiColorMode: 'default' | 'custom';
  colorPalette: string[];
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  textOffsetX: number;
  textOffsetY: number;
  padding: number;
  borderRadius: number;
  wordSpacing: number;
  selectedPresetId?: string | null;
  perRatioConfigs?: Record<string, SubtitleOverride>;
}

export interface SubtitlePreset {
  id: string;
  name: string;
  description: string;
  settings: SubtitleSettings;
}

export function createDefaultSubtitleSettings(): SubtitleSettings {
  return {
    enabled: true,
    fontFamily: 'Montserrat',
    fontSize: 48,
    fontWeight: 800,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundEnabled: false,
    border1Width: 0,
    border1Color: '#000000',
    border2Width: 4,
    border2Color: '#000000',
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    shadowBlur: 4,
    shadowColor: '#000000',
    position: 'bottom',
    positionPercentage: 85,
    maxWidth: 90,
    animationStyle: 'karaoke',
    highlightColor: '#FFFF00',
    multiColorEnabled: false,
    multiColorMode: 'default',
    colorPalette: ['#FFFFFF', '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF'],
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'center',
    textOffsetX: 0,
    textOffsetY: 0,
    padding: 8,
    borderRadius: 4,
    wordSpacing: 0.35,
    selectedPresetId: 'tiktok-bold',
    perRatioConfigs: {},
  };
}

export function parseSubtitleSettings(raw: string | null | undefined): SubtitleSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SubtitleSettings;
    return { ...createDefaultSubtitleSettings(), ...parsed };
  } catch {
    return null;
  }
}
