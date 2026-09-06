export type ClipEffectType =
  | 'grayscale'
  | 'sepia'
  | 'negative'
  | 'warm'
  | 'cool'
  | 'vignette'
  | 'grain'
  | 'blur'
  | 'sharpen'
  | 'letterbox'
  | 'glitch'
  | 'mirror'
  | 'brightness'
  | 'exposure'
  | 'contrast'
  | 'saturation'
  | 'temperature'
  | 'tint';

export interface ClipEffect {
  type: ClipEffectType;
  intensity: number;
}

export interface ClipEffectPreset {
  type: ClipEffectType;
  label: string;
  category: 'color' | 'style' | 'adjust';
}

export const CLIP_EFFECT_PRESETS: ClipEffectPreset[] = [
  { type: 'grayscale', label: 'B&W', category: 'color' },
  { type: 'sepia', label: 'Sepia', category: 'color' },
  { type: 'negative', label: 'Negative', category: 'color' },
  { type: 'warm', label: 'Warm', category: 'color' },
  { type: 'cool', label: 'Cool', category: 'color' },
  { type: 'brightness', label: 'Brightness', category: 'adjust' },
  { type: 'exposure', label: 'Exposure', category: 'adjust' },
  { type: 'contrast', label: 'Contrast', category: 'adjust' },
  { type: 'saturation', label: 'Saturation', category: 'adjust' },
  { type: 'temperature', label: 'Temp', category: 'adjust' },
  { type: 'tint', label: 'Tint', category: 'adjust' },
  { type: 'vignette', label: 'Vignette', category: 'style' },
  { type: 'grain', label: 'Grain', category: 'style' },
  { type: 'blur', label: 'Blur', category: 'style' },
  { type: 'sharpen', label: 'Sharpen', category: 'style' },
  { type: 'letterbox', label: 'Letterbox', category: 'style' },
  { type: 'glitch', label: 'Glitch', category: 'style' },
  { type: 'mirror', label: 'Mirror', category: 'style' },
];

export function clampEffectIntensity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function normalizeClipEffect(effect: ClipEffect | null | undefined): ClipEffect | null {
  if (!effect) return null;
  if (!CLIP_EFFECT_PRESETS.some((preset) => preset.type === effect.type)) return null;
  return { type: effect.type, intensity: clampEffectIntensity(effect.intensity) };
}

function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

export function effectColorMatrix(effect: ClipEffect): number[] | null {
  const t = clampEffectIntensity(effect.intensity) / 100;
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const mixMatrix = (target: number[]) => identity.map((value, index) => mix(value, target[index], t));

  switch (effect.type) {
    case 'grayscale':
      return mixMatrix([
        0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0, 0, 0, 1, 0,
      ]);
    case 'sepia':
      return mixMatrix([
        0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0,
      ]);
    case 'negative':
      return mixMatrix([-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0]);
    case 'warm':
      return mixMatrix([1.18, 0.04, 0, 0, 0.02, 0.04, 1.04, 0, 0, 0, 0, 0, 0.82, 0, 0, 0, 0, 0, 1, 0]);
    case 'cool':
      return mixMatrix([0.86, 0, 0.04, 0, 0, 0, 1.02, 0.04, 0, 0, 0.04, 0.06, 1.2, 0, 0.02, 0, 0, 0, 1, 0]);
    case 'sharpen':
      return mixMatrix([1.18, -0.06, -0.06, 0, 0, -0.06, 1.18, -0.06, 0, 0, -0.06, -0.06, 1.18, 0, 0, 0, 0, 0, 1, 0]);
    case 'brightness': {
      const b = (clampEffectIntensity(effect.intensity) - 50) / 50;
      return mixMatrix([1, 0, 0, 0, b * 0.16, 0, 1, 0, 0, b * 0.16, 0, 0, 1, 0, b * 0.16, 0, 0, 0, 1, 0]);
    }
    case 'contrast': {
      const c = 1 + ((clampEffectIntensity(effect.intensity) - 50) / 50) * 0.5;
      const o = 0.5 * (1 - c);
      return mixMatrix([c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0]);
    }
    case 'saturation': {
      const s = 1 + ((clampEffectIntensity(effect.intensity) - 50) / 50);
      const inv = 1 - s;
      const r = 0.3086 * inv;
      const g = 0.6094 * inv;
      const b = 0.082 * inv;
      return mixMatrix([
        r + s, g, b, 0, 0, r, g + s, b, 0, 0, r, g, b + s, 0, 0, 0, 0, 0, 1, 0,
      ]);
    }
    case 'exposure':
    case 'temperature':
    case 'tint':
    case 'vignette':
    case 'grain':
    case 'blur':
    case 'letterbox':
    case 'glitch':
    case 'mirror':
      return null;
    default:
      return null;
  }
}

export function buildClipEffectFilters(effect: ClipEffect | null | undefined): string[] {
  const normalized = normalizeClipEffect(effect);
  if (!normalized) return [];
  const t = normalized.intensity / 100;

  switch (normalized.type) {
    case 'grayscale': {
      const r0 = mix(1, 0.3, t);
      const r1 = mix(0, 0.59, t);
      const r2 = mix(0, 0.11, t);
      return [`colorchannelmixer=${r0.toFixed(3)}:${r1.toFixed(3)}:${r2.toFixed(3)}:0:${r0.toFixed(3)}:${r1.toFixed(3)}:${r2.toFixed(3)}:0:${r0.toFixed(3)}:${r1.toFixed(3)}:${r2.toFixed(3)}:0`];
    }
    case 'sepia': {
      const r0 = mix(1, 0.393, t);
      const r1 = mix(0, 0.769, t);
      const r2 = mix(0, 0.189, t);
      const g0 = mix(0, 0.349, t);
      const g1 = mix(1, 0.686, t);
      const g2 = mix(0, 0.168, t);
      const b0 = mix(0, 0.272, t);
      const b1 = mix(0, 0.534, t);
      const b2 = mix(1, 0.131, t);
      return [`colorchannelmixer=${r0.toFixed(3)}:${r1.toFixed(3)}:${r2.toFixed(3)}:0:${g0.toFixed(3)}:${g1.toFixed(3)}:${g2.toFixed(3)}:0:${b0.toFixed(3)}:${b1.toFixed(3)}:${b2.toFixed(3)}:0`];
    }
    case 'negative':
      return t > 0.99 ? ['negate'] : [`curves=r='0/${t.toFixed(3)}:1/${(1 - t).toFixed(3)}':g='0/${t.toFixed(3)}:1/${(1 - t).toFixed(3)}':b='0/${t.toFixed(3)}:1/${(1 - t).toFixed(3)}'`];
    case 'warm':
      return [`colorbalance=rs=${(0.28 * t).toFixed(3)}:gs=${(0.06 * t).toFixed(3)}:bs=${(-0.18 * t).toFixed(3)}`];
    case 'cool':
      return [`colorbalance=rs=${(-0.18 * t).toFixed(3)}:gs=0:bs=${(0.28 * t).toFixed(3)}`];
    case 'vignette': {
      const angle = (1 - Math.max(0.15, t) * 0.85) * (Math.PI / 2);
      return [`vignette=a=${angle.toFixed(3)}`];
    }
    case 'grain':
      return [`noise=alls=${Math.max(1, Math.round(t * 28))}:allf=t`];
    case 'blur': {
      const luma = Math.max(1, Math.round(t * 12));
      return [`boxblur=${luma}:${Math.max(1, Math.round(luma * 0.5))}:1`];
    }
    case 'sharpen':
      return [`unsharp=5:5:${(0.4 + t * 2.6).toFixed(2)}`];
    case 'letterbox': {
      const bar = Math.max(0.06, t * 0.18).toFixed(3);
      return [
        `drawbox=x=0:y=0:w=iw:h=ih*${bar}:color=black:t=fill`,
        `drawbox=x=0:y=ih*(1-${bar}):w=iw:h=ih*${bar}:color=black:t=fill`,
      ];
    }
    case 'glitch': {
      const shift = Math.max(1, Math.round(t * 10));
      const noise = Math.max(1, Math.round(t * 22));
      return [`rgbashift=rh=${shift}:bh=${-shift}`, `noise=alls=${noise}:allf=t`];
    }
    case 'mirror':
      return ['hflip'];
    default:
      return [];
  }
}

export function clipEffectVideoChain(
  effect: ClipEffect | null | undefined,
  speed: number,
  inputLabel = 'scaled',
): string {
  const filters = buildClipEffectFilters(effect);
  const speedFilter = speed !== 1 ? `setpts=PTS/${speed}` : null;
  const chain = [...filters, speedFilter].filter((part): part is string => Boolean(part));
  if (chain.length === 0) return `[${inputLabel}]null[v]`;
  return `[${inputLabel}]${chain.join(',')}[v]`;
}
