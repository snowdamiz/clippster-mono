import { interpolate } from 'remotion';
import type { KeyframeAnimation } from '../../types/ai-video';

export function getAnimatedValue(
  value: number | KeyframeAnimation | undefined,
  trackTime: number,
  trackDuration: number,
  fps: number
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;

  const keyframes = value.keyframes;
  if (keyframes.length === 0) return undefined;
  if (keyframes.length === 1) return keyframes[0].value;

  const normalizedTime = trackTime / trackDuration;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const current = keyframes[i];
    const next = keyframes[i + 1];

    if (normalizedTime >= current.time && normalizedTime <= next.time) {
      const segmentProgress = (normalizedTime - current.time) / (next.time - current.time);
      
      return interpolate(
        segmentProgress,
        [0, 1],
        [current.value, next.value],
        {
          easing: getEasingFunction(current.easing),
        }
      );
    }
  }

  if (normalizedTime <= keyframes[0].time) {
    return keyframes[0].value;
  }

  return keyframes[keyframes.length - 1].value;
}

function getEasingFunction(easing?: string): ((t: number) => number) | undefined {
  switch (easing) {
    case 'linear':
      return (t) => t;
    case 'ease-in':
      return (t) => t * t;
    case 'ease-out':
      return (t) => t * (2 - t);
    case 'ease-in-out':
      return (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    case 'spring':
      return undefined;
    default:
      return undefined;
  }
}
