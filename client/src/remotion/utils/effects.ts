import { CSSProperties } from 'react';
import type { Effect } from '../../types/ai-video';
import { getAnimatedValue } from './animations';

export function applyEffects(
  effects: Effect[],
  trackTime: number,
  trackDuration: number,
  fps: number
): CSSProperties {
  if (effects.length === 0) return {};

  const filters: string[] = [];

  for (const effect of effects) {
    const value = getAnimatedValue(effect.value, trackTime, trackDuration, fps);
    if (value === undefined) continue;

    switch (effect.type) {
      case 'blur':
        filters.push(`blur(${value}px)`);
        break;
      case 'brightness':
        filters.push(`brightness(${value})`);
        break;
      case 'contrast':
        filters.push(`contrast(${value})`);
        break;
      case 'saturation':
        filters.push(`saturate(${value})`);
        break;
      case 'hue-rotate':
        filters.push(`hue-rotate(${value}deg)`);
        break;
      case 'grayscale':
        filters.push(`grayscale(${value})`);
        break;
      case 'sepia':
        filters.push(`sepia(${value})`);
        break;
    }
  }

  return {
    filter: filters.length > 0 ? filters.join(' ') : undefined,
  };
}
