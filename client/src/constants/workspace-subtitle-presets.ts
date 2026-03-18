import { CAPTION_PRESETS, type CaptionPreset, type CaptionPresetCategory } from '@/editor/constants/caption-constants';
import type { SubtitleSettings } from '@/types';

export interface WorkspaceSubtitlePreset {
  id: string;
  name: string;
  description: string;
  category: CaptionPresetCategory;
  previewStyle: Record<string, string>;
  highlightPreviewStyle: Record<string, string>;
  sampleWords: string[];
  settings: SubtitleSettings;
}

const BASE_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontFamily: 'Montserrat',
  fontSize: 42,
  fontWeight: 700,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundEnabled: false,
  border1Width: 0,
  border1Color: '#FFFFFF',
  border2Width: 0,
  border2Color: '#000000',
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  shadowBlur: 4,
  shadowColor: 'rgba(0,0,0,0.8)',
  position: 'bottom',
  positionPercentage: 84,
  maxWidth: 82,
  animationStyle: 'none',
  highlightColor: '#FACC15',
  lineHeight: 1.3,
  letterSpacing: 0,
  textAlign: 'center',
  textOffsetX: 0,
  textOffsetY: 0,
  padding: 10,
  borderRadius: 10,
  wordSpacing: 0.35,
  selectedPresetId: null,
};

const CATEGORY_LABELS: Record<CaptionPresetCategory, string> = {
  'single-word': 'Single Word',
  classic: 'Classic',
  creator: 'Creator',
  colorful: 'Colorful',
  effects: 'Effects',
};

function normalizeFontWeight(weight: string | number | undefined): number {
  if (typeof weight === 'number') return weight;
  if (!weight) return 700;
  if (weight === 'normal') return 400;
  if (weight === 'bold') return 700;

  const parsed = Number(weight);
  return Number.isFinite(parsed) ? parsed : 700;
}

function getAnimationStyle(preset: CaptionPreset): SubtitleSettings['animationStyle'] {
  switch (preset.highlightStyle) {
    case 'karaoke':
      return 'karaoke';
    case 'karaoke-scale':
      return 'pop';
    case 'background':
      return 'box-highlight';
    case 'glow':
      return 'glow';
    default:
      return 'none';
  }
}

function getMaxWidth(maxWordsPerLine: number): number {
  if (maxWordsPerLine <= 1) return 55;
  if (maxWordsPerLine === 2) return 64;
  if (maxWordsPerLine === 3) return 74;
  if (maxWordsPerLine === 4) return 82;
  return 88;
}

function mapCaptionPresetToSubtitleSettings(preset: CaptionPreset): SubtitleSettings {
  const strokeWidth = preset.stroke?.width ?? 0;
  const innerStrokeWidth = strokeWidth > 0 ? Math.max(1, Math.round(strokeWidth * 0.35)) : 0;
  const outerStrokeWidth = strokeWidth > 0 ? Math.max(0, strokeWidth - innerStrokeWidth) : 0;
  const glowShadowColor = preset.glow?.color || preset.shadow?.color || BASE_SUBTITLE_SETTINGS.shadowColor;
  const glowShadowBlur = preset.glow?.intensity ?? preset.shadow?.blur ?? BASE_SUBTITLE_SETTINGS.shadowBlur;

  return {
    ...BASE_SUBTITLE_SETTINGS,
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    fontWeight: normalizeFontWeight(preset.fontWeight),
    textColor:
      preset.color === 'transparent'
        ? preset.gradient?.colors?.[0] || preset.stroke?.color || BASE_SUBTITLE_SETTINGS.textColor
        : preset.color,
    backgroundColor:
      preset.backgroundColor && preset.backgroundColor !== 'transparent'
        ? preset.backgroundColor
        : BASE_SUBTITLE_SETTINGS.backgroundColor,
    backgroundEnabled: Boolean(preset.backgroundColor && preset.backgroundColor !== 'transparent'),
    border1Width: innerStrokeWidth,
    border1Color: preset.stroke?.color || '#FFFFFF',
    border2Width: outerStrokeWidth,
    border2Color: '#000000',
    shadowOffsetX: preset.shadow?.offsetX ?? (preset.glow ? 0 : BASE_SUBTITLE_SETTINGS.shadowOffsetX),
    shadowOffsetY: preset.shadow?.offsetY ?? (preset.glow ? 0 : BASE_SUBTITLE_SETTINGS.shadowOffsetY),
    shadowBlur: glowShadowBlur,
    shadowColor: glowShadowColor,
    maxWidth: getMaxWidth(preset.maxWordsPerLine),
    animationStyle: getAnimationStyle(preset),
    highlightColor: preset.highlightColor,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
    padding:
      preset.backgroundColor && preset.backgroundColor !== 'transparent'
        ? 12
        : BASE_SUBTITLE_SETTINGS.padding,
    borderRadius:
      preset.backgroundColor && preset.backgroundColor !== 'transparent'
        ? 12
        : BASE_SUBTITLE_SETTINGS.borderRadius,
    selectedPresetId: preset.id,
  };
}

function getPreviewStyle(preset: CaptionPreset): Record<string, string> {
  const style: Record<string, string> = {
    color: preset.color === 'transparent' ? preset.stroke?.color || '#FFFFFF' : preset.color,
    fontFamily: preset.fontFamily,
    fontWeight: String(normalizeFontWeight(preset.fontWeight)),
    fontStyle: preset.fontStyle || 'normal',
    letterSpacing: `${preset.letterSpacing}px`,
    fontSize: '12px',
    lineHeight: '1.2',
  };

  if (preset.backgroundColor && preset.backgroundColor !== 'transparent') {
    style.backgroundColor = preset.backgroundColor;
    style.padding = '2px 6px';
    style.borderRadius = '4px';
  }

  const shadows: string[] = [];
  if (preset.stroke) {
    shadows.push(
      `-1px -1px 0 ${preset.stroke.color}`,
      `1px -1px 0 ${preset.stroke.color}`,
      `-1px 1px 0 ${preset.stroke.color}`,
      `1px 1px 0 ${preset.stroke.color}`
    );
  }
  if (preset.shadow) {
    shadows.push(
      `${preset.shadow.offsetX}px ${preset.shadow.offsetY}px ${preset.shadow.blur}px ${preset.shadow.color}`
    );
  }
  if (preset.glow) {
    shadows.push(`0 0 ${preset.glow.intensity}px ${preset.glow.color}`);
  }
  if (shadows.length > 0) {
    style.textShadow = shadows.join(', ');
  }

  if (preset.gradient?.enabled && preset.gradient.colors) {
    style.background = `linear-gradient(${preset.gradient.angle || 135}deg, ${preset.gradient.colors[0]}, ${preset.gradient.colors[1]})`;
    style['-webkit-background-clip'] = 'text';
    style['-webkit-text-fill-color'] = 'transparent';
    style.backgroundClip = 'text';
    delete style.color;
  }

  return style;
}

function getHighlightPreviewStyle(preset: CaptionPreset): Record<string, string> {
  if (preset.highlightStyle === 'none') {
    return getPreviewStyle(preset);
  }

  const style: Record<string, string> = {
    ...getPreviewStyle(preset),
    color: preset.highlightColor,
  };

  if (preset.gradient?.enabled && preset.gradient.colors) {
    delete style.background;
    delete style.backgroundClip;
    delete style['-webkit-background-clip'];
    delete style['-webkit-text-fill-color'];
  }

  return style;
}

function getSampleWords(preset: CaptionPreset): string[] {
  return preset.maxWordsPerLine <= 1 ? ['Now'] : ['Sample', 'Subtitle'];
}

export const WORKSPACE_SUBTITLE_PRESET_GROUPS = Object.entries(CATEGORY_LABELS).map(
  ([category, label]) => ({
    id: category as CaptionPresetCategory,
    label,
    presets: CAPTION_PRESETS.filter((preset) => preset.category === category).map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      category: preset.category,
      previewStyle: getPreviewStyle(preset),
      highlightPreviewStyle: getHighlightPreviewStyle(preset),
      sampleWords: getSampleWords(preset),
      settings: mapCaptionPresetToSubtitleSettings(preset),
    })),
  })
);

export function getWorkspaceSubtitlePresetById(presetId: string | null | undefined): WorkspaceSubtitlePreset | null {
  if (!presetId) return null;

  for (const group of WORKSPACE_SUBTITLE_PRESET_GROUPS) {
    const match = group.presets.find((preset) => preset.id === presetId);
    if (match) return match;
  }

  return null;
}
