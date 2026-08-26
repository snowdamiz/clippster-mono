import type { SubtitleSettings, WordInfo } from '@clippster/shared-types';

export interface SubtitleAssInput {
  settings: SubtitleSettings;
  words: WordInfo[];
  clipDuration: number;
  targetRatio: string;
  outputPath: string;
}

function assColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '&H00FFFFFF';
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function getEffectiveSettings(settings: SubtitleSettings, targetRatio: string): SubtitleSettings {
  const override = settings.perRatioConfigs?.[targetRatio];
  if (!override) return settings;
  return {
    ...settings,
    fontSize: override.fontSize ?? settings.fontSize,
    positionPercentage: override.positionPercentage ?? settings.positionPercentage,
    animationStyle: override.animationStyle ?? settings.animationStyle,
    textColor: override.textColor ?? settings.textColor,
    fontFamily: override.fontFamily ?? settings.fontFamily,
    fontWeight: override.fontWeight ?? settings.fontWeight,
    border1Width: override.border1Width ?? settings.border1Width,
    border1Color: override.border1Color ?? settings.border1Color,
    border2Width: override.border2Width ?? settings.border2Width,
    border2Color: override.border2Color ?? settings.border2Color,
    highlightColor: override.highlightColor ?? settings.highlightColor,
  };
}

export function buildSubtitleAssContent(input: SubtitleAssInput): string {
  const settings = getEffectiveSettings(input.settings, input.targetRatio);
  const marginV = Math.round((100 - settings.positionPercentage) * 19.2);
  const outline = settings.border1Width + settings.border2Width;

  const header = `[Script Info]
Title: Clippster Export
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${settings.fontFamily},${settings.fontSize},${assColor(settings.textColor)},${assColor(settings.highlightColor)},${assColor(settings.border1Color)},${assColor(settings.backgroundColor)},${settings.fontWeight >= 700 ? -1 : 0},0,0,0,100,100,${settings.letterSpacing},0,1,${outline},${settings.shadowBlur},2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = input.words
    .map((word) => {
      const start = formatAssTime(Math.max(0, word.start));
      const end = formatAssTime(Math.min(input.clipDuration, word.end));
      const text = word.word.replace(/\n/g, ' ').replace(/[{}]/g, '');
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  return header + events + '\n';
}

export function buildSubtitleBurnInArgs(
  videoInputLabel: string,
  assPath: string,
  outputLabel = 'subbed',
): string {
  return `[${videoInputLabel}]ass='${assPath.replace(/'/g, "'\\''")}'[${outputLabel}]`;
}
