import { createDefaultSubtitleSettings, type SubtitleSettings } from '@clippster/shared-types';
import { CAPTION_PRESETS } from '../editor/constants/caption-constants';
export function captionPresetSettings(id: string, position = 85, width = 90): SubtitleSettings | null {
  const preset = CAPTION_PRESETS.find(value => value.id === id);
  if (!preset) return null;
  const animations: Record<string, SubtitleSettings['animationStyle']> = { none: 'none', karaoke: 'karaoke', 'karaoke-scale': 'karaoke', zoom: 'zoom', pop: 'pop', glow: 'glow', 'box-highlight': 'box-highlight', typewriter: 'typewriter', wave: 'wave' };
  return { ...createDefaultSubtitleSettings(), enabled: true, selectedPresetId: preset.id, fontFamily: preset.fontFamily || 'Montserrat', fontSize: preset.fontSize || 48,
    fontWeight: preset.fontWeight === 'bold' ? 700 : preset.fontWeight === 'normal' ? 400 : Number(preset.fontWeight || 700), textColor: preset.color || '#FFFFFF', backgroundColor: preset.backgroundColor || 'transparent', backgroundEnabled: preset.backgroundColor !== 'transparent',
    position: 'bottom', positionPercentage: position, maxWidth: width, animationStyle: animations[preset.highlightStyle] || 'none', highlightColor: preset.highlightColor || '#0ea5e9', multiColorEnabled: false, multiColorMode: 'default', colorPalette: [],
    border1Width: preset.stroke?.width || 0, border1Color: preset.stroke?.color || '#000000', border2Width: 0, border2Color: '#000000', shadowBlur: preset.shadow?.blur || 0, shadowOffsetX: preset.shadow?.offsetX || 0, shadowOffsetY: preset.shadow?.offsetY || 0, shadowColor: preset.shadow?.color || '#000000',
    lineHeight: preset.lineHeight || 1.2, letterSpacing: preset.letterSpacing || 0, textAlign: 'center', textOffsetX: 0, textOffsetY: 0, padding: 0, borderRadius: 0, wordSpacing: .35 };
}
export function resolveCaptionSettings(settings: SubtitleSettings | null | undefined, ratio: string, enabled = settings?.enabled ?? false): SubtitleSettings {
  const base = { ...createDefaultSubtitleSettings(), ...settings }, override = base.perRatioConfigs?.[ratio];
  const preset = override?.presetId ? captionPresetSettings(override.presetId) : null;
  return { ...base, ...preset, ...override, position: base.position, perRatioConfigs: base.perRatioConfigs, enabled };
}
